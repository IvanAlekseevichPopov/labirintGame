// Night on a dark level: the scene is drawn as usual, then covered with black that only the
// lights cut through: the rover's headlights (stopped by walls), its tail lights, a glow around
// the landmarks, the beacon on the rocket, meteor impacts. Drawn by render.js after the rover.

export const NIGHT = {
  reach: 3.4,       // headlight range, cells
  halfAngle: 0.27,  // half of one beam's width, radians
  splay: 0.14,      // each beam turned outwards by this much, so the two read as two
  rays: 48,         // rays per beam; more is smoother shadows, slower frames
  glow: 0.95,       // faint light around the rover itself, cells
  beacon: 0.55,
  dark: 'rgba(3, 4, 14, 0.985)',
};

// Lamp positions in rover space (facing +x, 1 = rover size).
const LAMPS = { front: [[0.31, -0.16, -1], [0.31, 0.16, 1]], rear: [[-0.4, -0.2], [-0.4, 0.2]] };

// Switching on: dark, a couple of flickers, then steady. [ms since lightsAt, brightness].
const SWITCH_ON = [[80, 1], [150, 0.1], [230, 1], [290, 0.25], [Infinity, 1]];
function brightness(sinceLightsAt, now) {
  if (sinceLightsAt < 0) return 0;
  const level = SWITCH_ON.find(([until]) => sinceLightsAt < until)[1];
  return level * (0.97 + 0.03 * Math.sin(now / 90) * Math.sin(now / 37));
}

const LANDMARK_LIGHTS = {
  antenna: now => ({ r: 0.8, strength: Math.floor(now / 600) % 2 ? 0.85 : 0.3, tint: 'rgba(255, 70, 50, 0.22)' }),
  flag: () => ({ r: 0.85, strength: 0.75, tint: 'rgba(255, 220, 150, 0.14)' }),
  crater: () => ({ r: 0.7, strength: 0.35, tint: null }),
};

const DUST_PER_BEAM = 28;

// Distance along the ray (px) to the nearest wall, or `max` if none within reach.
export function castRay(px, py, dx, dy, max, walls) {
  let best = max;
  for (const [ax, ay, bx, by] of walls) {
    const sx = bx - ax, sy = by - ay;
    const denom = dx * sy - dy * sx;
    if (!denom) continue;
    const qx = ax - px, qy = ay - py;
    const t = (qx * sy - qy * sx) / denom;
    if (t <= 0 || t >= best) continue;
    const u = (qx * dy - qy * dx) / denom;
    if (u >= 0 && u <= 1) best = t;
  }
  return best;
}

export function beamPolygon(ox, oy, angle, reach, walls) {
  const pts = [[ox, oy]];
  for (let k = 0; k <= NIGHT.rays; k++) {
    const a = angle - NIGHT.halfAngle + (2 * NIGHT.halfAngle * k) / NIGHT.rays;
    const dx = Math.cos(a), dy = Math.sin(a);
    const t = castRay(ox, oy, dx, dy, reach, walls);
    pts.push([ox + dx * t, oy + dy * t]);
  }
  return pts;
}

export function fillPolygon(g, pts, style) {
  g.fillStyle = style;
  g.beginPath();
  pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
  g.closePath();
  g.fill();
}

export function radial(g, x, y, r, alpha, rgb = '0,0,0') {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${alpha})`);
  grad.addColorStop(0.5, `rgba(${rgb},${alpha * 0.6})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// Walls near the lamp are the only ones a beam can hit.
function nearby(walls, x, y, reach) {
  return walls.filter(([ax, ay, bx, by]) =>
    Math.max(ax, bx) >= x - reach && Math.min(ax, bx) <= x + reach &&
    Math.max(ay, by) >= y - reach && Math.min(ay, by) <= y + reach);
}

export function createNight() {
  // Dust motes live in beam space: `d` along the beam (0..1), `a` across it (-1..1).
  const dust = LAMPS.front.map(() => Array.from({ length: DUST_PER_BEAM }, () => ({
    d: Math.random(), a: Math.random() * 2 - 1, speed: 0.04 + Math.random() * 0.08, r: 0.6 + Math.random(),
  })));
  let last = null;

  // scene: { w, h, cell, walls (px segments), rover: { x, y, angle, size } | null, goal: { x, y },
  //         flame, landmarks: [{ type, x, y }] (px), sinceLightsAt, lights: [{ x, y, r, strength }],
  //         trackLayer }
  return function drawNight(ctx, layer, now, scene) {
    const { w, h, cell, rover, walls } = scene;
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const b = brightness(scene.sinceLightsAt, now);
    const reach = cell * NIGHT.reach;

    const lamp = ([lx, ly]) => {
      const cos = Math.cos(rover.angle), sin = Math.sin(rover.angle);
      return [rover.x + (lx * cos - ly * sin) * rover.size, rover.y + (lx * sin + ly * cos) * rover.size];
    };
    const beams = rover && b > 0
      ? LAMPS.front.map(l => {
        const [x, y] = lamp(l), angle = rover.angle + l[2] * NIGHT.splay;
        return { x, y, angle, pts: beamPolygon(x, y, angle, reach, nearby(walls, x, y, reach)) };
      })
      : [];

    const g = layer.getContext('2d');
    const dpr = devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.fillStyle = NIGHT.dark;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'destination-out';
    // Old tracks stay faintly visible: a trail of where the rover has already been.
    g.globalAlpha = 0.55;
    g.drawImage(scene.trackLayer, 0, 0, w, h);
    g.globalAlpha = 1;

    if (rover) radial(g, rover.x, rover.y, cell * NIGHT.glow, 0.3 + 0.7 * b);
    for (const beam of beams) {
      const grad = g.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
      grad.addColorStop(0, `rgba(0,0,0,${b})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${b * 0.85})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      fillPolygon(g, beam.pts, grad);
    }
    if (rover && b > 0) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(g, x, y, cell * 0.14, 0.4 * b); }

    for (const l of scene.landmarks) {
      const light = LANDMARK_LIGHTS[l.type]?.(now);
      if (light) radial(g, l.x, l.y, cell * light.r, light.strength);
    }
    const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(now / 350));
    radial(g, scene.goal.x, scene.goal.y, cell * NIGHT.beacon * pulse, 0.9);
    if (scene.flame) radial(g, scene.goal.x, scene.goal.y, cell * 5, 0.95 + 0.05 * Math.random());
    for (const l of scene.lights) radial(g, l.x, l.y, l.r, l.strength);

    ctx.drawImage(layer, 0, 0, w, h);

    // Colour on top of the holes, so each light looks like its own kind of light.
    for (const beam of beams) {
      const tint = ctx.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
      tint.addColorStop(0, `rgba(255, 236, 170, ${0.16 * b})`);
      tint.addColorStop(1, 'rgba(255, 236, 170, 0)');
      fillPolygon(ctx, beam.pts, tint);
    }
    if (rover && b > 0) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(ctx, x, y, cell * 0.16, 0.35 * b, '255,40,30'); }
    for (const l of scene.landmarks) {
      const light = LANDMARK_LIGHTS[l.type]?.(now);
      if (light?.tint) { ctx.fillStyle = light.tint; radial(ctx, l.x, l.y, cell * light.r, light.strength * 0.3, light.tint.match(/\d+, \d+, \d+/)[0]); }
    }
    for (const l of scene.lights) radial(ctx, l.x, l.y, l.r, 0.35 * l.strength, '255,190,120');
    if (scene.flame) radial(ctx, scene.goal.x, scene.goal.y, cell * 5, 0.2 + 0.05 * Math.random(), '255,170,80');

    // Dust drifting in the beams, clipped by the same shadows.
    beams.forEach((beam, i) => {
      ctx.save();
      ctx.beginPath();
      beam.pts.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](x, y));
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#fff6dc';
      for (const m of dust[i]) {
        m.d += m.speed * dt;
        if (m.d > 1) { m.d -= 1; m.a = Math.random() * 2 - 1; }
        const a = beam.angle + m.a * NIGHT.halfAngle * 0.9;
        const dist = m.d * reach;
        ctx.globalAlpha = (1 - m.d) * 0.7 * b * Math.min(1, m.d * 6);
        ctx.beginPath();
        ctx.arc(beam.x + Math.cos(a) * dist, beam.y + Math.sin(a) * dist, m.r * cell / 60, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  };
}

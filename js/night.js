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

// Lamp positions in rover space (facing +x, 1 = rover size); the third number of a front lamp
// is which way its beam splays. The rovers in art.js draw their lamps at these spots.
export const LAMPS = { front: [[0.31, -0.16, -1], [0.31, 0.16, 1]], rear: [[-0.4, -0.2], [-0.4, 0.2]] };

// Switching on: dark, a couple of flickers, then steady. [ms since lightsAt, brightness].
const SWITCH_ON = [[80, 1], [150, 0.1], [230, 1], [290, 0.25], [Infinity, 1]];
export function brightness(sinceLightsAt, now) {
  if (sinceLightsAt < 0) return 0;
  const level = SWITCH_ON.find(([until]) => sinceLightsAt < until)[1];
  return level * (0.97 + 0.03 * Math.sin(now / 90) * Math.sin(now / 37));
}

// Radius in cells, how much light, and its colour (null for none) on top of the hole.
const LANDMARK_LIGHTS = {
  antenna: now => ({ r: 0.8, strength: Math.floor(now / 600) % 2 ? 0.85 : 0.3, tint: '255,70,50' }),
  flag: () => ({ r: 0.85, strength: 0.75, tint: '255,220,150' }),
  crater: () => ({ r: 0.7, strength: 0.35, tint: null }),
};

// Deterministic flicker in [0, 1): on pause the clock stops and so does the flame.
const jitter = now => (Math.sin(now / 23) * 43758.5453) % 1;

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

// The rover's lights, shared by the night and the storm: `cut` punches them out of the veil
// (the layer must be in destination-out), `paint` colours them on the finished frame and
// drifts dust through the beams. `opts.reach` is in cells, `opts.strength` how much of the
// veil a beam clears (less in dust than in clear night air), `opts.tint` how yellow the beams are.
// `opts.wind` (cells per second, screen-space, blowing to +x) turns the slow motes into sand
// streaking through the beams.
export function createHeadlights({ reach: reachCells = NIGHT.reach, strength = 1, tint = 0.16, wind = 0 } = {}) {
  // Dust motes live in beam space: `d` along the beam (0..1), `a` across it (-1..1).
  // In wind they live in screen space around the lamp instead: `ox`/`oy` in units of reach.
  const dust = LAMPS.front.map(() => Array.from({ length: wind ? DUST_PER_BEAM * 2 : DUST_PER_BEAM }, () => ({
    d: Math.random(), a: Math.random() * 2 - 1, speed: 0.04 + Math.random() * 0.08, r: 0.6 + Math.random(),
    ox: Math.random() * 2 - 1, oy: Math.random() * 2 - 1,
  })));
  let beams = [], lamp = null, reach = 0;

  return {
    cut(g, { rover, walls, cell }, b) {
      reach = cell * reachCells;
      lamp = rover && (([lx, ly]) => {
        const cos = Math.cos(rover.angle), sin = Math.sin(rover.angle);
        return [rover.x + (lx * cos - ly * sin) * rover.size, rover.y + (lx * sin + ly * cos) * rover.size];
      });
      beams = rover && b > 0
        ? LAMPS.front.map(l => {
          const [x, y] = lamp(l), angle = rover.angle + l[2] * NIGHT.splay;
          return { x, y, angle, pts: beamPolygon(x, y, angle, reach, nearby(walls, x, y, reach)) };
        })
        : [];
      for (const beam of beams) {
        const grad = g.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
        grad.addColorStop(0, `rgba(0,0,0,${b * strength})`);
        grad.addColorStop(0.55, `rgba(0,0,0,${b * strength * 0.85})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        fillPolygon(g, beam.pts, grad);
      }
      if (beams.length) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(g, x, y, cell * 0.14, 0.4 * b); }
    },

    paint(ctx, { cell }, b, dt) {
      for (const beam of beams) {
        const glow = ctx.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
        glow.addColorStop(0, `rgba(255, 230, 120, ${tint * b})`);
        glow.addColorStop(0.6, `rgba(255, 230, 120, ${tint * b * 0.5})`);
        glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
        fillPolygon(ctx, beam.pts, glow);
      }
      if (beams.length) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(ctx, x, y, cell * 0.16, 0.35 * b, '255,40,30'); }

      // Dust drifting in the beams, clipped by the same shadows.
      beams.forEach((beam, i) => {
        ctx.save();
        ctx.beginPath();
        beam.pts.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](x, y));
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = '#fff6dc';
        if (wind) {
          ctx.strokeStyle = '#fff1d6';
          ctx.lineWidth = cell * 0.035;
          for (const m of dust[i]) {
            m.ox += (wind * cell * dt / reach) * (0.7 + m.speed * 4);
            if (m.ox > 1) { m.ox -= 2; m.oy = (Math.random() * 2 - 1) * 0.7; }
            const x = beam.x + m.ox * reach, y = beam.y + m.oy * reach;
            ctx.globalAlpha = 0.9 * b * Math.max(0, 1 - Math.hypot(m.ox, m.oy) * 0.8);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - cell * 0.22 * m.r, y);
            ctx.stroke();
          }
          ctx.restore();
          return;
        }
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
    },
  };
}

export function createNight() {
  const headlights = createHeadlights();
  let last = null;

  // scene: { w, h, cell, walls (px segments), rover: { x, y, angle, size } | null, goal: { x, y },
  //         flame, landmarks: [{ type, x, y }] (px), sinceLightsAt, lights: [{ x, y, r, strength }],
  //         trackLayer }
  return function drawNight(ctx, layer, now, scene) {
    const { w, h, cell, rover } = scene;
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const b = brightness(scene.sinceLightsAt, now);

    const g = layer.getContext('2d');
    const dpr = devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = 1;
    g.fillStyle = NIGHT.dark;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'destination-out';
    // Old tracks stay faintly visible: a trail of where the rover has already been.
    g.globalAlpha = 0.55;
    g.drawImage(scene.trackLayer, 0, 0, w, h);
    g.globalAlpha = 1;

    if (rover) radial(g, rover.x, rover.y, cell * NIGHT.glow, 0.3 + 0.7 * b);
    headlights.cut(g, scene, b);

    const lit = scene.landmarks.map(l => ({ ...l, light: LANDMARK_LIGHTS[l.type]?.(now) })).filter(l => l.light);
    for (const { x, y, light } of lit) radial(g, x, y, cell * light.r, light.strength);
    const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(now / 350));
    radial(g, scene.goal.x, scene.goal.y, cell * NIGHT.beacon * pulse, 0.9);
    if (scene.flame) radial(g, scene.goal.x, scene.goal.y, cell * 5, 0.95 + 0.05 * jitter(now));
    for (const l of scene.lights) radial(g, l.x, l.y, l.r, l.strength);

    ctx.drawImage(layer, 0, 0, w, h);

    // Colour on top of the holes, so each light looks like its own kind of light.
    headlights.paint(ctx, scene, b, dt);
    for (const { x, y, light } of lit) {
      if (light.tint) radial(ctx, x, y, cell * light.r, light.strength * 0.3, light.tint);
    }
    for (const l of scene.lights) radial(ctx, l.x, l.y, l.r, 0.35 * l.strength, '255,190,120');
    if (scene.flame) radial(ctx, scene.goal.x, scene.goal.y, cell * 5, 0.2 + 0.05 * jitter(now), '255,170,80');
  };
}

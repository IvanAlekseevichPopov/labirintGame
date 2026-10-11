// The rover's lights, used wherever the view is veiled (night.js, storm.js): two beams stopped
// by walls, tail lights, and something drifting through the light. Everything that differs by
// planet and weather is a preset in HEADLIGHTS; the drawing code is the same.

// Beam shape and look. Lengths in cells; colours as 'r,g,b'.
const DEFAULT = {
  reach: 3.4,
  halfAngle: 0.27,   // half of one beam's width, radians
  splay: 0.14,       // each beam turned outwards by this much, so the two read as two
  rays: 48,          // rays per beam; more is smoother shadows, slower frames
  strength: 1,       // how much of the veil a beam clears at the lamp
  color: '255,236,170',
  tint: 0.16,        // how strongly the beam is coloured
  tail: { color: '255,40,30', r: 0.16, strength: 0.35 },
  // What floats through the light: motes drift slowly along the beam, sand is blown across it
  // (screen-space wind towards +x, cells per second).
  dust: { kind: 'motes', count: 28, color: '255,246,220' },
};

// Nested settings (dust, tail) are merged field by field; `dust: null` switches the dust off,
// and a planet setting dust again on top of null starts from the defaults.
const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const under = isPlain(base[k]) ? base[k] : isPlain(DEFAULT[k]) ? DEFAULT[k] : null;
    out[k] = isPlain(v) && under ? merge(under, v) : v;
  }
  return out;
}

// [veil][planet]; a planet not listed gets the veil's `default`.
export const HEADLIGHTS = {
  night: {
    default: {},
    moon: {},
    mars: { color: '255,220,160', dust: { count: 36, color: '255,200,150' } },
    europa: { color: '220,240,255', tint: 0.12, dust: { count: 40, color: '240,250,255' } },
  },
  storm: {
    default: { reach: 3.2, strength: 0.9, color: '255,230,120', tint: 0.4, dust: { kind: 'sand', count: 56, wind: 7, color: '255,241,214' } },
  },
};

export const headlightPreset = (veil, planet) =>
  merge(merge(DEFAULT, HEADLIGHTS[veil].default), HEADLIGHTS[veil][planet] ?? {});

// Lamp positions in rover space (facing +x, 1 = rover size); the third number of a front lamp
// is which way its beam splays. The rovers in art.js draw their lamps at these spots.
export const LAMPS = { front: [[0.31, -0.16, -1], [0.31, 0.16, 1]], rear: [[-0.4, -0.2], [-0.4, 0.2]] };

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

export function beamPolygon(ox, oy, angle, reach, walls, { rays, halfAngle }) {
  const pts = [[ox, oy]];
  for (let k = 0; k <= rays; k++) {
    const a = angle - halfAngle + (2 * halfAngle * k) / rays;
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

const clipTo = (ctx, pts) => {
  ctx.beginPath();
  pts.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](x, y));
  ctx.closePath();
  ctx.clip();
};

// Motes live in beam space: `d` along the beam (0..1), `a` across it (-1..1).
function motes({ count, color }, preset) {
  const list = Array.from({ length: count }, () => ({
    d: Math.random(), a: Math.random() * 2 - 1, speed: 0.04 + Math.random() * 0.08, r: 0.6 + Math.random(),
  }));
  return (ctx, beam, reach, cell, b, dt) => {
    ctx.fillStyle = `rgb(${color})`;
    for (const m of list) {
      m.d += m.speed * dt;
      if (m.d > 1) { m.d -= 1; m.a = Math.random() * 2 - 1; }
      const a = beam.angle + m.a * preset.halfAngle * 0.9;
      const dist = m.d * reach;
      ctx.globalAlpha = (1 - m.d) * 0.7 * b * Math.min(1, m.d * 6);
      ctx.beginPath();
      ctx.arc(beam.x + Math.cos(a) * dist, beam.y + Math.sin(a) * dist, m.r * cell / 60, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

// Sand lives in screen space around the lamp, `ox`/`oy` in units of reach, and blows to +x.
function sand({ count, color, wind }) {
  const list = Array.from({ length: count }, () => ({
    ox: Math.random() * 2 - 1, oy: (Math.random() * 2 - 1) * 0.7, speed: 0.7 + Math.random() * 0.5, len: 0.6 + Math.random(),
  }));
  return (ctx, beam, reach, cell, b, dt) => {
    ctx.strokeStyle = `rgb(${color})`;
    ctx.lineWidth = cell * 0.035;
    for (const s of list) {
      s.ox += (wind * cell * dt / reach) * s.speed;
      if (s.ox > 1) { s.ox -= 2; s.oy = (Math.random() * 2 - 1) * 0.7; }
      const x = beam.x + s.ox * reach, y = beam.y + s.oy * reach;
      ctx.globalAlpha = 0.9 * b * Math.max(0, 1 - Math.hypot(s.ox, s.oy) * 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - cell * 0.22 * s.len, y);
      ctx.stroke();
    }
  };
}

// `cut` punches the lights out of the veil (the layer must be in destination-out), `paint`
// colours them on the finished frame and moves the dust. `b` is brightness 0..1.
export function createHeadlights(preset) {
  const dust = preset.dust && LAMPS.front.map(() => (preset.dust.kind === 'sand' ? sand : motes)(preset.dust, preset));
  let beams = [], lamp = null, reach = 0;

  return {
    cut(g, { rover, walls, cell }, b) {
      reach = cell * preset.reach;
      lamp = rover && (([lx, ly]) => {
        const cos = Math.cos(rover.angle), sin = Math.sin(rover.angle);
        return [rover.x + (lx * cos - ly * sin) * rover.size, rover.y + (lx * sin + ly * cos) * rover.size];
      });
      beams = rover && b > 0
        ? LAMPS.front.map(l => {
          const [x, y] = lamp(l), angle = rover.angle + l[2] * preset.splay;
          return { x, y, angle, pts: beamPolygon(x, y, angle, reach, nearby(walls, x, y, reach), preset) };
        })
        : [];
      for (const beam of beams) {
        const grad = g.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
        grad.addColorStop(0, `rgba(0,0,0,${b * preset.strength})`);
        grad.addColorStop(0.55, `rgba(0,0,0,${b * preset.strength * 0.85})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        fillPolygon(g, beam.pts, grad);
      }
      if (beams.length) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(g, x, y, cell * preset.tail.r * 0.9, preset.tail.strength * 1.1 * b); }
    },

    paint(ctx, { cell }, b, dt) {
      const { color, tint, tail } = preset;
      for (const beam of beams) {
        const glow = ctx.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
        glow.addColorStop(0, `rgba(${color},${tint * b})`);
        glow.addColorStop(0.6, `rgba(${color},${tint * b * 0.5})`);
        glow.addColorStop(1, `rgba(${color},0)`);
        fillPolygon(ctx, beam.pts, glow);
      }
      if (beams.length) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(ctx, x, y, cell * tail.r, tail.strength * b, tail.color); }
      if (dust) {
        beams.forEach((beam, i) => {
          ctx.save();
          clipTo(ctx, beam.pts);
          dust[i](ctx, beam, reach, cell, b, dt);
          ctx.restore();
        });
      }
      ctx.globalAlpha = 1;
    },
  };
}

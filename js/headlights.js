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
  // What floats through the light. Motes hang over the whole maze (`perCell` per cell), each
  // drifting its own way at `speed` cells per second and wandering off course by up to `turn`
  // radians per second; only those in the `near` share of a beam show. Sand is blown across the
  // beam (`count` per beam, screen-space wind towards +x, cells per second).
  dust: { kind: 'motes', perCell: 4, speed: 0.06, turn: 0.8, near: 0.7, color: '255,246,220' },
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
    mars: { color: '255,220,160', dust: { perCell: 4.5, color: '255,200,150' } },
    europa: { color: '220,240,255', tint: 0.12, dust: { perCell: 5, color: '240,250,255' } },
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

function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Dust specks of a few kinds, drawn around 0,0 with size 1 (about a sixtieth of a cell).
const SPECKS = [
  // round grain
  () => (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); },
  // ragged flake
  () => {
    const pts = Array.from({ length: 5 }, (_, k) => [k * Math.PI * 0.4, 0.6 + Math.random() * 0.9]);
    return (ctx, r) => {
      ctx.beginPath();
      pts.forEach(([a, d], k) => ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * d * r * 1.1, Math.sin(a) * d * r * 1.1));
      ctx.closePath();
      ctx.fill();
    };
  },
  // two grains stuck together
  () => (ctx, r) => {
    ctx.beginPath();
    ctx.arc(-r * 0.5, 0, r * 0.8, 0, Math.PI * 2);
    ctx.arc(r * 0.7, r * 0.2, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  },
];

// Motes live in maze space (`u`, `v` 0..1 across the maze) and the beams only light them up:
// moving with the beam, away from the lamps, they looked shot out of the rover.
function motes({ perCell, speed, turn, near, color }) {
  let list = null;
  return (ctx, beams, reach, { cell, area }, b, dt) => {
    list ??= Array.from({ length: Math.round((area.w * area.h) / cell ** 2 * perCell) }, () => ({
      u: Math.random(), v: Math.random(), heading: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 0.7,
      draw: SPECKS[Math.floor(Math.random() * SPECKS.length)](), angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.2,
    }));
    ctx.fillStyle = `rgb(${color})`;
    for (const m of list) {
      m.heading += (Math.random() - 0.5) * 2 * turn * dt;
      m.angle += m.spin * dt;
      m.u = (m.u + (Math.cos(m.heading) * speed * dt * cell) / area.w + 1) % 1;
      m.v = (m.v + (Math.sin(m.heading) * speed * dt * cell) / area.h + 1) % 1;
      const x = area.x + m.u * area.w, y = area.y + m.v * area.h;
      for (const beam of beams) {
        const share = Math.hypot(x - beam.x, y - beam.y) / reach;
        if (share >= near || !inside(beam.pts, x, y)) continue;
        ctx.globalAlpha = 0.7 * b * Math.min(1, (near - share) / 0.2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(m.angle);
        m.draw(ctx, m.r * cell / 60);
        ctx.restore();
        break;
      }
    }
  };
}

// Sand lives in screen space around each lamp, `ox`/`oy` in units of reach, and blows to +x.
function sand(opts) {
  const blowers = LAMPS.front.map(() => blower(opts));
  return (ctx, beams, reach, { cell }, b, dt) => beams.forEach((beam, i) => {
    ctx.save();
    clipTo(ctx, beam.pts);
    blowers[i](ctx, beam, reach, cell, b, dt);
    ctx.restore();
  });
}

function blower({ count, color, wind }) {
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
  const dust = preset.dust && (preset.dust.kind === 'sand' ? sand : motes)(preset.dust);
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

    paint(ctx, scene, b, dt) {
      const { cell } = scene;
      const { color, tint, tail } = preset;
      for (const beam of beams) {
        const glow = ctx.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, reach);
        glow.addColorStop(0, `rgba(${color},${tint * b})`);
        glow.addColorStop(0.6, `rgba(${color},${tint * b * 0.5})`);
        glow.addColorStop(1, `rgba(${color},0)`);
        fillPolygon(ctx, beam.pts, glow);
      }
      if (beams.length) for (const l of LAMPS.rear) { const [x, y] = lamp(l); radial(ctx, x, y, cell * tail.r, tail.strength * b, tail.color); }
      if (dust) dust(ctx, beams, reach, scene, b, dt);
      ctx.globalAlpha = 1;
    },
  };
}

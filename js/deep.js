// Night in the ocean seen from the side (`dark: true` under water). The water is black but for
// what gives off light: the drone's glow and searchlight, the jellyfish, the bell, a lamp people
// left; the ice and the rock over the water are dimmed less, lit a little from the sky. Now and
// then the drone's sonar sends out a ring (game.js times it): as the ring passes, the walls light
// up as one glowing outline and fade, and the bell answers with rings of its own if it is in reach.
// Lights that do not move are drawn once per layout (buildDeep); every frame only the drone's own.

import { beamPolygon, nearby } from './headlights.js';

export const DEEP = {
  dark: 'rgba(2, 5, 14, 0.985)',
  // How much of the dark a light at full strength clears: only a little, so the deep stays deep
  // and a light reads as a glow in it, not as a window cut in the night.
  lit: 0.23,
  crust: 'rgba(2, 5, 14, 0.7)',
  // The drone: how far its light clears the dark (cells), and the faint blue halo over it.
  glow: { reach: 2.4, halo: 1.6, strength: 0.4, color: '150, 210, 240' },
  // Its lamp at night, so many times further and wider than by day.
  lamp: { reach: 2.6, spread: 1.35 },
};
export const SONAR = {
  reach: 9,          // cells
  speed: 8,          // cells a second
  fadeMs: 2600,      // how long an outline glows after the ring passed it
  color: '110, 250, 225',
  goal: '255, 214, 110',
  blipMs: 1100,
};
// Points round a light its shadows are cast from (shares of a cell), so they are soft.
const SOFT = { spread: 0.18, from: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], rays: 36 };

const scratch = document.createElement('canvas');
const echo = document.createElement('canvas');
const outlines = document.createElement('canvas');
// Lights drawn once: holes in the dark ({ canvas, x, y, r }) and coloured light over it, with
// `light` for one that blinks (its strength now, from landmarks.js, out of `full`).
let holes = [];
let glows = [];

function fit(c, w, h) {
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
}

// Light from (x, y) out to r px, cast against `walls` (px segments) from a few points so the
// shadows are soft: the shapes add up into how much of it reaches each spot, then the light goes
// on once through that. Painted onto `target` with `op`.
function castLight(target, { x, y, r, strength, color = '255, 255, 255' }, walls, cell, op) {
  const dpr = devicePixelRatio || 1;
  const size = Math.ceil(r * 2 * dpr);
  fit(scratch, size, size);
  const g = scratch.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, size, size);
  g.setTransform(dpr, 0, 0, dpr, (r - x) * dpr, (r - y) * dpr);
  const spread = cell * SOFT.spread;
  const near = nearby(walls, x, y, r + spread);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 1 / SOFT.from.length;
  g.fillStyle = '#fff';
  for (const [dx, dy] of SOFT.from) {
    const pts = beamPolygon(x + dx * spread, y + dy * spread, 0, r, near, { rays: SOFT.rays, halfAngle: Math.PI });
    g.beginPath();
    pts.forEach(([px, py], i) => i && g[i > 1 ? 'lineTo' : 'moveTo'](px, py));
    g.closePath();
    g.fill();
  }
  // Bright near the light, then falling off softly to nothing at r.
  g.globalCompositeOperation = 'source-in';
  g.globalAlpha = 1;
  const a = Math.min(1, strength) * DEEP.lit;
  const fall = g.createRadialGradient(x, y, 0, x, y, r);
  fall.addColorStop(0, `rgba(${color}, ${a})`);
  fall.addColorStop(0.5, `rgba(${color}, ${a * 0.85})`);
  fall.addColorStop(0.8, `rgba(${color}, ${a * 0.4})`);
  fall.addColorStop(1, `rgba(${color}, 0)`);
  g.fillStyle = fall;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  target.save();
  target.globalCompositeOperation = op;
  target.drawImage(scratch, 0, 0, size, size, x - r, y - r, r * 2, r * 2);
  target.restore();
}

function bake(light, walls, cell) {
  const dpr = devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(light.r * 2 * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, (light.r - light.x) * dpr, (light.r - light.y) * dpr);
  castLight(g, light, walls, cell, 'source-over');
  return { canvas, x: light.x, y: light.y, r: light.r, light: light.light, full: light.full };
}

// Once per layout. `shapes` are the walls as drawn (px polygons, overlapping where walls meet);
// `walls` their middle lines (px segments): a light shows the face of a wall it reaches.
// `holes` are the lights that do not move, `glows` the coloured light some of them shed.
export function buildDeep({ shapes, walls, cell, holes: still, glows: shed }) {
  holes = still.map(l => bake(l, walls, cell));
  glows = shed.map(l => bake(l, walls, cell));

  // What a ping shows: the outline of all the walls together. Outlining each piece would show
  // where they meet inside the rock, so it is the edge of their union: a wide stroke round every
  // piece with every piece's inside cut away again, then the union filled faintly once.
  const dpr = devicePixelRatio || 1;
  outlines.width = innerWidth * dpr;
  outlines.height = innerHeight * dpr;
  const g = outlines.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const trace = (c, pts) => {
    c.beginPath();
    pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y));
    c.closePath();
  };
  g.lineJoin = 'round';
  g.strokeStyle = `rgb(${SONAR.color})`;
  g.lineWidth = cell * 0.07;
  for (const pts of shapes) {
    trace(g, pts);
    g.stroke();
  }
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (const pts of shapes) {
    trace(g, pts);
    g.fill();
  }
  // Filled solid on a layer of its own first, so the overlaps do not add up.
  const inside = document.createElement('canvas');
  inside.width = outlines.width;
  inside.height = outlines.height;
  const f = inside.getContext('2d');
  f.setTransform(dpr, 0, 0, dpr, 0, 0);
  f.fillStyle = `rgb(${SONAR.color})`;
  for (const pts of shapes) {
    trace(f, pts);
    f.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 0.12;
  g.drawImage(inside, 0, 0);
}

// Every frame, after the drone. scene: { w, h, cell, water, crust: { x, y, w, h } px, walls (px
// segments), drone: { x, y, strength } | null, lamp: { x, y, angle, len, spread, strength } | null
// (its daytime beam), sonar: { at, from: { x, y } px | null }, goal: { x, y } px }
export function drawDeep(ctx, layer, now, scene) {
  const { w, h, cell, water, crust, walls, drone } = scene;
  const dpr = devicePixelRatio || 1;
  const g = layer.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'copy';
  g.fillStyle = DEEP.crust;
  g.fillRect(crust.x, crust.y, crust.w, crust.h);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, crust.y);
  g.clearRect(0, crust.y, crust.x, h);
  g.clearRect(crust.x + crust.w, crust.y, w, h);
  g.fillStyle = DEEP.dark;
  g.fillRect(water.x, water.y, water.w, water.h);

  g.globalCompositeOperation = 'destination-out';
  for (const l of holes) g.drawImage(l.canvas, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  if (drone) castLight(g, { x: drone.x, y: drone.y, r: cell * DEEP.glow.reach, strength: drone.strength }, walls, cell, 'destination-out');
  const beam = scene.lamp && searchlight(scene.lamp, walls);
  if (beam) {
    const fall = g.createLinearGradient(beam.x, beam.y, beam.x + Math.cos(beam.angle) * beam.len, beam.y + Math.sin(beam.angle) * beam.len);
    fall.addColorStop(0, `rgba(0, 0, 0, ${beam.strength})`);
    fall.addColorStop(0.6, `rgba(0, 0, 0, ${0.75 * beam.strength})`);
    fall.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = fall;
    fillPolygon(g, beam.pts);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer, 0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // The beam itself, a warm haze in the water over what it lights.
  if (beam) {
    const haze = ctx.createLinearGradient(beam.x, beam.y, beam.x + Math.cos(beam.angle) * beam.len, beam.y + Math.sin(beam.angle) * beam.len);
    haze.addColorStop(0, `rgba(255, 243, 190, ${0.45 * beam.strength})`);
    haze.addColorStop(0.5, `rgba(255, 243, 190, ${0.15 * beam.strength})`);
    haze.addColorStop(1, 'rgba(255, 243, 190, 0)');
    ctx.fillStyle = haze;
    fillPolygon(ctx, beam.pts);
  }
  for (const l of glows) {
    ctx.globalAlpha = l.light ? l.light(now).strength / l.full : 1;
    ctx.drawImage(l.canvas, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.restore();
  if (drone) castLight(ctx, { x: drone.x, y: drone.y, r: cell * DEEP.glow.halo, strength: DEEP.glow.strength * drone.strength, color: DEEP.glow.color }, walls, cell, 'lighter');
  drawSonar(ctx, now, scene);
}

function searchlight({ x, y, angle, len, spread, strength }, walls) {
  const reach = len * DEEP.lamp.reach;
  const pts = beamPolygon(x, y, angle, reach, nearby(walls, x, y, reach), { rays: 32, halfAngle: spread * DEEP.lamp.spread });
  return { x, y, angle, len: reach, pts, strength };
}

function fillPolygon(g, pts) {
  g.beginPath();
  pts.forEach(([px, py], i) => g[i ? 'lineTo' : 'moveTo'](px, py));
  g.closePath();
  g.fill();
}

const clamp01 = v => Math.max(0, Math.min(1, v));

function drawSonar(ctx, now, { w, h, cell, water, sonar, goal }) {
  if (!sonar.from) return;
  const age = now - sonar.at;
  const speed = SONAR.speed * cell / 1000;
  const reach = SONAR.reach * cell;
  if (age > reach / speed + SONAR.fadeMs) return;
  const front = age * speed;
  const { x: sx, y: sy } = sonar.from;
  const dpr = devicePixelRatio || 1;

  // The outlines, shown where the ring has been: brightest just behind it, fading to nothing
  // SONAR.fadeMs after it passed, and fading out towards the edge of its reach.
  const r = Math.min(front, reach);
  const box = { x: Math.max(0, sx - r), y: Math.max(0, sy - r), x1: Math.min(w, sx + r), y1: Math.min(h, sy + r) };
  const bw = Math.ceil((box.x1 - box.x) * dpr), bh = Math.ceil((box.y1 - box.y) * dpr);
  if (r > 0 && bw > 0 && bh > 0) {
    fit(echo, bw, bh);
    const g = echo.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.drawImage(outlines, box.x * dpr, box.y * dpr, bw, bh, 0, 0, bw, bh);
    g.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
    g.globalCompositeOperation = 'destination-in';
    const shown = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    for (let k = 0; k <= 12; k++) {
      const at = r * k / 12;
      const since = (front - at) / speed;
      const edge = 1 - clamp01((at / reach - 0.7) / 0.3);
      shown.addColorStop(k / 12, `rgba(0, 0, 0, ${(clamp01(1 - since / SONAR.fadeMs) ** 1.4 * edge).toFixed(3)})`);
    }
    g.fillStyle = shown;
    g.beginPath();
    g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(echo, 0, 0, bw, bh, box.x, box.y, bw / dpr, bh / dpr);
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(water.x, water.y, water.w, water.h);
  ctx.clip();
  // The ring itself, thinning out as it goes.
  if (front < reach) {
    const fade = (1 - front / reach) ** 0.6;
    ctx.lineWidth = cell * 0.05;
    ctx.strokeStyle = `rgba(${SONAR.color}, ${(0.55 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, front, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = cell * 0.12;
    ctx.strokeStyle = `rgba(${SONAR.color}, ${(0.2 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0, front - cell * 0.15), 0, Math.PI * 2);
    ctx.stroke();
  }
  // The goal answers when the ring reaches it: rings spreading from the bell, in its own yellow.
  const toGoal = Math.hypot(goal.x - sx, goal.y - sy);
  const since = (front - toGoal) / speed;
  if (toGoal <= reach && since >= 0 && since < SONAR.blipMs) {
    ctx.lineWidth = cell * 0.05;
    for (const lag of [0, 0.3]) {
      const t = since / SONAR.blipMs - lag;
      if (t < 0) continue;
      ctx.strokeStyle = `rgba(${SONAR.goal}, ${(0.9 * (1 - t)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(goal.x, goal.y, cell * (0.3 + 0.9 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

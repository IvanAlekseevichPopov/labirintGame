// The ocean under Enceladus' ice, seen from the side, drawn once into the maze layer: the rock the
// maze is cut into, water darkening with depth, light falling through cracks in the ice crust over
// the top, smokers on the sea floor. All of it outside the corridors or see-through, so
// nothing reads as something in the way.

import { crack } from './art.js';
import { drawCloud } from './launch.js';
import { mulberry32 } from './random.js';

// Where cracks run right through the crust: the light shafts in the water start under them.
export function crustCracks(seed, x, w, cell) {
  const rand = mulberry32(seed + 3100);
  const n = Math.max(2, Math.round(w / cell / 3.5));
  return Array.from({ length: n }, (_, k) => x + ((k + 0.25 + rand() * 0.5) / n) * w);
}

// Ragged edge from (x0, y0) to (x1, y1), pushed out along (nx, ny) by up to `amp` px.
function raggedEdge(rand, x0, y0, x1, y1, step, amp, nx, ny) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n, out = (k === 0 || k === n) ? 0 : rand() * amp;
    return [x0 + (x1 - x0) * t + nx * out, y0 + (y1 - y0) * t + ny * out];
  });
}

function path(g, pts, close = true) {
  g.beginPath();
  pts.forEach(([px, py], k) => g[k ? 'lineTo' : 'moveTo'](px, py));
  if (close) g.closePath();
}

// Fills for the walls from `top` to `bottom` px: ice in the upper part, rock in the lower.
const ICE_TO_ROCK = [0.3, 0.62];

export function wallPaint(g, p, top, bottom) {
  const paint = ([ice, rock]) => {
    const fill = g.createLinearGradient(0, top, 0, bottom);
    fill.addColorStop(0, ice);
    fill.addColorStop(ICE_TO_ROCK[0], ice);
    fill.addColorStop(ICE_TO_ROCK[1], rock);
    fill.addColorStop(1, rock);
    return fill;
  };
  return { base: paint([p.iceWall, p.wallBase]), top: paint([p.iceWallTop, p.wallTop]) };
}

// The walls' colours at `depth` (0 under the crust, 1 at the sea floor) as 'r, g, b', for what is
// stirred off them: `base` and `top` as in wallPaint().
export function wallTint(p, depth) {
  const k = Math.max(0, Math.min(1, (depth - ICE_TO_ROCK[0]) / (ICE_TO_ROCK[1] - ICE_TO_ROCK[0])));
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const mix = (ice, rock) => rgb(ice).map((v, i) => Math.round(v + (rgb(rock)[i] - v) * k));
  return { base: mix(p.iceWall, p.wallBase), top: mix(p.iceWallTop, p.wallTop) };
}

// The rock around the maze, down the sides and under the sea floor; `frame` is the maze's outer
// edge in px, and the rock reaches `side` px past it to the sides and `bottom` px below. `paint`
// is from wallPaint(), so up by the crust it is ice like the walls.
export function drawRockMass(g, p, { frame, side, bottom, cell, seed, paint }) {
  const rand = mulberry32(seed + 3200);
  const x0 = frame.x - side, x1 = frame.x + frame.w + side, y0 = frame.y, y1 = frame.y + frame.h + bottom;
  const amp = cell * 0.08, step = cell * 0.25;
  const outline = [
    ...raggedEdge(rand, x0, y0, x0, y1, step, amp, -1, 0),
    ...raggedEdge(rand, x0, y1, x1, y1, step, amp, 0, 1).slice(1),
    ...raggedEdge(rand, x1, y1, x1, y0, step, amp, 1, 0).slice(1),
  ];
  path(g, outline);
  g.fillStyle = paint.base;
  g.fill();
  g.save();
  path(g, outline);
  g.clip();
  // Layers of rock under the floor, and pebbles set in it.
  g.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  g.lineWidth = cell * 0.025;
  g.lineCap = 'round';
  for (let k = 1; k <= 2; k++) {
    const y = frame.y + frame.h + bottom * (k / 3);
    path(g, raggedEdge(rand, x0, y, x1, y, step, cell * 0.04, 0, 1), false);
    g.stroke();
  }
  for (let k = 0, n = Math.round((frame.w + frame.h * 2) / cell * 1.2); k < n; k++) {
    const t = rand(), r = cell * (0.03 + rand() * 0.04), across = 0.2 + rand() * 0.5;
    // Spread round the band: down the left, along the bottom, up the right.
    const along = t * (frame.h * 2 + frame.w);
    const [px, py] = along < frame.h ? [x0 + side * across, y0 + along]
      : along < frame.h + frame.w ? [frame.x + along - frame.h, frame.y + frame.h + bottom * across]
        : [x1 - side * across, y0 + along - frame.h - frame.w];
    g.beginPath();
    g.ellipse(px, py, r * 1.3, r, rand() * Math.PI, 0, Math.PI * 2);
    g.fillStyle = rand() < 0.5 ? paint.top : 'rgba(0, 0, 0, 0.3)';
    g.fill();
  }
  g.restore();
}

// Lumps of ice frozen onto the walls' corners and joints, many just under the crust and thinning
// out with depth. Small, about the wall's own width, so they never narrow a corridor.
export function drawFrost(g, p, segments, { cell, ox, oy, rows, seed }) {
  const rand = mulberry32(seed + 3400);
  const joints = new Map();
  for (const [x0, y0, x1, y1] of segments) for (const [x, y] of [[x0, y0], [x1, y1]]) joints.set(`${x},${y}`, [x, y]);
  for (const [x, y] of [...joints.values()].sort(([ax, ay], [bx, by]) => ay - by || ax - bx)) {
    const chance = 0.85 * (1 - y / (rows * 0.55)), roll = rand(), size = rand(), lean = rand();
    if (roll >= chance) continue;
    const cx = ox + x * cell + (lean - 0.5) * cell * 0.06, cy = oy + y * cell + cell * 0.03, r = cell * (0.08 + size * 0.05);
    softLump(g, cx, cy + r * 0.15, r, 'rgba(10, 50, 90, 0.3)');
    softLump(g, cx, cy, r, p.iceShade);
    softLump(g, cx - r * 0.2, cy - r * 0.25, r * 0.62, p.ice);
  }
}

function softLump(g, cx, cy, r, fill) {
  g.beginPath();
  for (let k = 0; k <= 7; k++) {
    const a = (k / 7) * Math.PI * 2, rr = r * (0.85 + 0.15 * Math.sin(a * 3 + cx));
    g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr * 1.15, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

// Water over `x, y, w, h` (the caller has clipped to it), `surface` being where the ice's underside
// hangs; `cracks` from crustCracks().
export function fillWater(g, p, { x, y, w, h, cell, surface, cracks }) {
  const depth = g.createLinearGradient(0, y, 0, y + h);
  p.water.forEach((color, i) => depth.addColorStop(i / (p.water.length - 1), color));
  g.fillStyle = depth;
  g.fillRect(x, y, w, h);

  const ripple = g.createLinearGradient(0, surface, 0, surface + cell * 0.18);
  ripple.addColorStop(0, 'rgba(220, 245, 255, 0.35)');
  ripple.addColorStop(1, 'rgba(220, 245, 255, 0)');
  g.fillStyle = ripple;
  g.fillRect(x, surface, w, cell * 0.18);

  // A shaft of light under each crack, widening and fading with depth, all slanting the same way.
  const rand = mulberry32(cracks.length * 7 + 4000);
  for (const cx of cracks) {
    const top = cell * 0.25, wide = cell * (0.8 + rand() * 0.3), lean = cell * 0.9;
    const reach = (y + h - surface) * (0.55 + rand() * 0.3);
    const shaft = g.createLinearGradient(0, surface, 0, surface + reach);
    shaft.addColorStop(0, 'rgba(225, 248, 255, 0.3)');
    shaft.addColorStop(1, 'rgba(225, 248, 255, 0)');
    g.fillStyle = shaft;
    path(g, [[cx - top / 2, surface], [cx + top / 2, surface], [cx + wide / 2 + lean, surface + reach], [cx - wide / 2 + lean, surface + reach]]);
    g.fill();
  }
}

// A smoker standing on the floor of its cell (W or B in the level): the floor itself swells into a
// mound that narrows into a chimney, chalk-white or sooty black, low enough to stay below the drone.
// `x` is the cell's middle and `line` the middle of the wall under it, `half` the wall's half-width.
// Returns its mouth, for drawSmoke().
const SMOKER = { span: 0.55, mound: 0.12, chimney: 0.1 };

export function drawSmoker(g, p, { x: sx, line, half, cell, white }) {
  const floor = line - half;
  const SPAN = cell * SMOKER.span, MOUND = cell * SMOKER.mound, CHIMNEY = cell * SMOKER.chimney;
  const bell = (d, reach) => (Math.abs(d) < reach ? (1 + Math.cos(Math.PI * d / reach)) / 2 : 0);
  const rise = d => MOUND * bell(d, SPAN) + CHIMNEY * bell(d, cell * 0.14);
  const profile = dy => Array.from({ length: 25 }, (_, k) => {
    const px = sx - SPAN + (k / 24) * SPAN * 2;
    return [px, dy - rise(px - sx)];
  });
  const mound = [...profile(floor), [sx + SPAN, line], [sx - SPAN, line]];
  path(g, mound);
  g.fillStyle = p.wallBase;
  g.fill();
  // The wall's lit top swells up into the mound, so the floor and the smoker are one piece.
  const band = line - cell * 0.016, lit = half * 0.45;
  path(g, [...profile(band - lit), [sx + SPAN, band + lit], [sx - SPAN, band + lit]]);
  g.fillStyle = p.wallTop;
  g.fill();
  const top = floor - MOUND - CHIMNEY;
  const [r, gr, b] = white ? [236, 242, 245] : [22, 25, 31];
  const chimney = g.createLinearGradient(0, floor - MOUND * 0.5, 0, top);
  chimney.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0)`);
  chimney.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 1)`);
  path(g, mound);
  g.fillStyle = chimney;
  g.fill();
  if (white) {
    g.beginPath();
    g.ellipse(sx, top + cell * 0.01, cell * 0.035, cell * 0.015, 0, 0, Math.PI * 2);
    g.fillStyle = '#9fb3bf';
    g.fill();
  } else {
    const mouth = g.createRadialGradient(sx, top, 0, sx, top, cell * 0.1);
    mouth.addColorStop(0, 'rgba(255, 190, 100, 0.9)');
    mouth.addColorStop(1, 'rgba(255, 120, 40, 0)');
    g.fillStyle = mouth;
    g.fillRect(sx - cell * 0.1, top - cell * 0.1, cell * 0.2, cell * 0.2);
  }
  return { x: sx, y: top, white };
}

// A few pebbles on the sea floor (`floor` px, from `x` for `w` px), kept off the smokers at `clear`.
export function drawPebbles(g, p, { x, w, floor, cell, seed, clear }) {
  const rand = mulberry32(seed + 3300);
  for (let k = 0; k < 4; k++) {
    const px = x + w * (0.05 + rand() * 0.9), r = cell * (0.05 + rand() * 0.03);
    if (clear.some(sx => Math.abs(sx - px) < cell * SMOKER.span + r)) continue;
    g.beginPath();
    g.ellipse(px, floor - r * 0.4, r * 1.4, r, 0, 0, Math.PI * 2);
    g.fillStyle = p.wallBase;
    g.fill();
    g.beginPath();
    g.ellipse(px - r * 0.3, floor - r * 0.7, r * 0.8, r * 0.45, 0, 0, Math.PI * 2);
    g.fillStyle = p.wallTop;
    g.fill();
  }
}

// Smoke rolling up from the smokers, every frame, white or black like its chimney. Low down it is
// a column of overlapping puffs drawn as one cloud, like the rocket's; higher up the column fades out while the same puffs, now
// soft blobs, keep growing, drift off to one side or the other and fade into the water. Half
// see-through throughout, so the drone plainly swims through it.
const SMOKE = { everyMs: 160, lifeMs: 2800, rise: 1.1, alpha: 0.7, handOver: [0.18, 0.55] };

const SMOKE_TINT = {
  white: { shade: '#cfdbe3', light: '#f2f6f8', haze: '225, 235, 241' },
  black: { shade: '#2c3039', light: '#454a55', haze: '44, 48, 57' },
};

const ease = (t, from, to) => Math.max(0, Math.min(1, (t - from) / (to - from)));
// The column is drawn apart and faded out towards its top before it goes on screen: one cloud
// cannot fade puff by puff, and a cut-off cloud would leave a hard edge against the haze.
const columnLayer = document.createElement('canvas');

export function drawSmoke(ctx, mouths, now, cell) {
  const [soft, solid] = SMOKE.handOver;
  ctx.save();
  ctx.globalAlpha = SMOKE.alpha;
  for (const [i, m] of mouths.entries()) {
    const column = [], haze = [];
    const first = Math.floor((now - SMOKE.lifeMs) / SMOKE.everyMs) + 1;
    for (let n = first; n * SMOKE.everyMs <= now; n++) {
      const t = (now - n * SMOKE.everyMs) / SMOKE.lifeMs;
      const rand = mulberry32(n * 31 + i * 7);
      const size = 0.8 + rand() * 0.4, side = rand() * 2 - 1;
      const x = m.x + t * cell * 0.08 + side * cell * 0.8 * ease(t, soft, 1) ** 1.5 + Math.sin(t * 4 + n) * cell * 0.02;
      const y = m.y - t * SMOKE.rise * cell;
      if (t < solid) column.push({ x, y, r: cell * (0.045 + 0.06 * t + 0.32 * t * t) * size * ease(t, 0, 0.12) });
      if (t > soft) haze.push({ x, y, r: cell * (0.09 + 0.4 * (t - soft)) * size, a: ease(t, soft, solid) * (1 - ease(t, solid, 1)) });
    }
    for (const h of haze) {
      const blob = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      const tint = SMOKE_TINT[m.white ? 'white' : 'black'].haze;
      blob.addColorStop(0, `rgba(${tint}, ${0.9 * h.a})`);
      blob.addColorStop(0.6, `rgba(${tint}, ${0.5 * h.a})`);
      blob.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = blob;
      ctx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    drawColumn(ctx, column, m, cell, soft, solid);
  }
  ctx.restore();
}

function drawColumn(ctx, column, m, cell, soft, solid) {
  const dpr = devicePixelRatio || 1;
  const box = { x: m.x - cell * 0.6, y: m.y - cell * (SMOKE.rise * solid + 0.3), w: cell * 1.2, h: cell * (SMOKE.rise * solid + 0.45) };
  const pw = Math.ceil(box.w * dpr), ph = Math.ceil(box.h * dpr);
  if (!pw || !ph) return;
  if (columnLayer.width < pw || columnLayer.height < ph) {
    columnLayer.width = Math.max(columnLayer.width, pw);
    columnLayer.height = Math.max(columnLayer.height, ph);
  }
  const g = columnLayer.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, pw, ph);
  g.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
  const { shade, light } = SMOKE_TINT[m.white ? 'white' : 'black'];
  drawCloud(g, column, cell * 0.02, shade, light);
  const fade = g.createLinearGradient(0, m.y - SMOKE.rise * cell * soft, 0, m.y - SMOKE.rise * cell * solid);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = fade;
  g.fillRect(box.x, box.y, box.w, box.h);
  ctx.drawImage(columnLayer, 0, 0, pw, ph, box.x, box.y, box.w, box.h);
}

// The crust from `top` (its snowy surface) down to `bottom`, where its knobbly underside hangs
// into the water over the top row; it covers the maze's top frame wall.
// `hole` is the x of the shaft cut through for the probe's cable.
export function drawIceCrust(g, p, { x, w, top, bottom, cell, seed, cracks, hole }) {
  const rand = mulberry32(seed + 3000);
  const r = cell * 0.13;
  const steps = Math.max(8, Math.round(w / (cell * 0.22)));
  const under = Array.from({ length: steps + 1 }, (_, k) => {
    const bulge = rand() < 0.15 ? cell * (0.05 + rand() * 0.06) : 0;
    return [x + (k / steps) * w, bottom + cell * (0.01 + rand() * 0.03) + bulge];
  });
  const surface = Array.from({ length: steps + 1 }, (_, k) => [x + (k / steps) * w, top + cell * 0.03 * Math.sin(k * 0.9 + seed)]);
  const outline = () => {
    g.beginPath();
    g.moveTo(x, surface[0][1] + r);
    g.quadraticCurveTo(x, surface[0][1], x + r, surface[0][1]);
    for (const [px, py] of surface.slice(1, -1)) g.lineTo(px, py);
    g.quadraticCurveTo(x + w, surface[steps][1], x + w, surface[steps][1] + r);
    for (const [px, py] of [...under].reverse()) g.lineTo(px, py);
  };

  // Shade on the water under the ice, so the crust looks thick and stands off the water.
  path(g, under.map(([px, py]) => [px, py + cell * 0.03]), false);
  g.strokeStyle = 'rgba(10, 50, 90, 0.4)';
  g.lineWidth = cell * 0.06;
  g.lineJoin = 'round';
  g.stroke();

  const body = g.createLinearGradient(0, top, 0, bottom);
  body.addColorStop(0, p.ice);
  body.addColorStop(0.55, p.iceShade);
  body.addColorStop(1, p.iceDeep);
  outline();
  g.fillStyle = body;
  g.fill();

  g.save();
  outline();
  g.clip();
  const thick = bottom - top;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Layers of old ice through its thickness.
  g.strokeStyle = 'rgba(120, 180, 215, 0.3)';
  g.lineWidth = cell * 0.025;
  for (const f of [0.35, 0.55, 0.75]) {
    g.beginPath();
    for (let px = x; px <= x + w; px += cell * 0.2) g.lineTo(px, top + thick * f + Math.sin(px / cell * 1.7 + f * 9) * cell * 0.025);
    g.stroke();
  }
  g.fillStyle = p.speck;
  g.beginPath();
  surface.forEach(([px, py], k) => g[k ? 'lineTo' : 'moveTo'](px, py));
  for (const [px, py] of [...surface].reverse()) g.lineTo(px, py + cell * (0.07 + 0.03 * Math.sin(px / cell * 2.3)));
  g.fill();
  // Cracks right through with light showing in them, a spur off each; short ones up from below.
  const fissure = (pts, width) => {
    path(g, pts, false);
    g.strokeStyle = 'rgba(30, 90, 140, 0.8)';
    g.lineWidth = width;
    g.stroke();
    g.strokeStyle = 'rgba(235, 250, 255, 0.9)';
    g.lineWidth = width * 0.35;
    g.stroke();
  };
  for (const cx of cracks) {
    const pts = crack([[cx - cell * 0.08, top], [cx + cell * 0.05, top + thick * 0.5], [cx, bottom + cell * 0.05]], rand, 3);
    fissure(pts, cell * 0.05);
    const [bx, by] = pts[3 + Math.floor(rand() * (pts.length - 6))], side = rand() < 0.5 ? -1 : 1;
    fissure(crack([[bx, by], [bx + side * cell * 0.3, by + thick * 0.25]], rand, 2), cell * 0.03);
  }
  for (let k = 0, n = Math.round(w / cell / 2.5); k < n; k++) {
    const cx = x + ((k + 0.5) / n) * w + (rand() - 0.5) * cell;
    if (cracks.some(c => Math.abs(c - cx) < cell * 0.6)) continue;
    path(g, crack([[cx, bottom + cell * 0.05], [cx + (rand() - 0.5) * cell * 0.3, bottom - thick * (0.3 + rand() * 0.25)]], rand, 2), false);
    g.strokeStyle = 'rgba(40, 110, 160, 0.6)';
    g.lineWidth = cell * 0.025;
    g.stroke();
  }
  const shaft = g.createLinearGradient(hole - cell * 0.13, 0, hole + cell * 0.13, 0);
  shaft.addColorStop(0, 'rgba(240, 250, 255, 0.9)');
  shaft.addColorStop(0.25, p.water[1]);
  shaft.addColorStop(0.75, p.water[1]);
  shaft.addColorStop(1, 'rgba(240, 250, 255, 0.9)');
  g.fillStyle = shaft;
  g.fillRect(hole - cell * 0.13, top - cell * 0.1, cell * 0.26, thick + cell * 0.25);
  g.restore();
}

// The rocket's probe: a docking bell on a cable from the rocket's foot (`topY`), hanging over the
// goal at (`x`, `y`). Its open bottom pulses yellow like the landing pads on the other planets:
// that is where the drone goes in. `alpha` fades it out as it is reeled into the rocket.
export function drawProbe(ctx, x, y, topY, cell, now, alpha = 1) {
  if (alpha <= 0) return;
  const r = cell * 0.22, skirt = cell * 0.16, pulse = 0.5 + 0.4 * Math.sin(now / 300);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, y - r - cell * 0.06);
  ctx.strokeStyle = '#2b2f38';
  ctx.lineWidth = cell * 0.03;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - r - cell * 0.04, cell * 0.035, 0, Math.PI * 2);
  ctx.strokeStyle = '#8d939e';
  ctx.lineWidth = cell * 0.02;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.lineTo(x + r * 1.15, y + skirt);
  ctx.lineTo(x - r * 1.15, y + skirt);
  ctx.closePath();
  ctx.fillStyle = '#eef1f5';
  ctx.fill();
  ctx.strokeStyle = '#1c1e26';
  ctx.lineWidth = cell * 0.02;
  ctx.stroke();
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(x - r * 1.02, y + skirt * 0.05, r * 2.04, skirt * 0.4);
  ctx.beginPath();
  ctx.arc(x, y - r * 0.35, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#8fe3ff';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - r * 1.02, cell * 0.035, Math.PI, 0);
  ctx.fillStyle = `rgba(255, 214, 10, ${0.6 + 0.4 * pulse})`;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x, y + skirt, r * 1.15, cell * 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2230';
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 214, 10, ${pulse})`;
  ctx.lineWidth = cell * 0.04;
  ctx.stroke();
  ctx.restore();
}

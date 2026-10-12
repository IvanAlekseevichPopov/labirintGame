// Sprites drawn straight onto the main canvas: rovers, landmarks, rocket, text.

import { mulberry32 } from './random.js';

const OUTLINE = '#1c1e26';
let ctx;

export function useContext(context) {
  ctx = context;
}

function box(cx, cy, w, h, r, fill, stroke = false) {
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

function dot(cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(points, color, width) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const pt of points.slice(1)) ctx.lineTo(...pt);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

// Rovers are drawn in unit space facing +x, scaled to `size` pixels.
function withRoverSpace(cx, cy, angle, size, draw) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw();
  ctx.restore();
}

function drawLunokhod(cx, cy, angle, size) {
  withRoverSpace(cx, cy, angle, size, () => {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    for (const x of [-0.33, -0.11, 0.11, 0.33]) {
      for (const y of [-0.4, 0.4]) box(x, y, 0.17, 0.13, 0.04, '#2b2d33', true);
    }
    box(0, 0, 0.84, 0.68, 0.14, '#d5d9e0', true);
    box(-0.12, 0, 0.52, 0.6, 0.05, '#2f6fd6', true);
    for (const x of [-0.25, -0.12, 0.01]) line([[x, -0.28], [x, 0.28]], '#8fb8ff', 0.015);
    for (const y of [-0.1, 0.1]) line([[-0.36, y], [0.12, y]], '#8fb8ff', 0.015);
    for (const y of [-0.16, 0.16]) dot(0.31, y, 0.06, '#ffd60a');
  });
}

// The ice drill sits at the front, so the direction of travel is obvious at a glance.
function drawIcebreaker(cx, cy, angle, size) {
  withRoverSpace(cx, cy, angle, size, () => {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    for (const y of [-0.36, 0.36]) {
      box(-0.04, y, 0.82, 0.2, 0.09, '#2b2d33', true);
      for (let x = -0.4; x <= 0.33; x += 0.12) line([[x, y - 0.08], [x, y + 0.08]], '#5b5f6b', 0.03);
    }
    ctx.beginPath();
    ctx.moveTo(0.27, -0.13);
    ctx.lineTo(0.56, 0);
    ctx.lineTo(0.27, 0.13);
    ctx.closePath();
    ctx.fillStyle = '#c3c8d1';
    ctx.fill();
    ctx.stroke();
    line([[0.33, -0.09], [0.37, 0.07]], OUTLINE, 0.02);
    line([[0.41, -0.06], [0.45, 0.04]], OUTLINE, 0.02);
    box(-0.06, 0, 0.62, 0.52, 0.1, '#ff7a1a', true);
    box(0.13, 0, 0.13, 0.36, 0.04, '#1d3557', true);
    line([[0.1, -0.12], [0.1, -0.02]], '#8fb8ff', 0.025);
    for (const y of [-0.21, 0.21]) {
      dot(0.19, y, 0.055, '#ffd60a');
      ctx.stroke();
    }
    box(-0.3, 0, 0.08, 0.2, 0.03, '#7a3a10');
  });
}

function drawMarsRover(cx, cy, angle, size) {
  withRoverSpace(cx, cy, angle, size, () => {
    for (const y of [-0.4, 0.4]) line([[-0.3, y], [0.3, y]], '#5a5650', 0.05);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    for (const x of [-0.3, 0, 0.3]) {
      for (const y of [-0.4, 0.4]) {
        box(x, y, 0.2, 0.15, 0.05, '#33302c', true);
        dot(x, y, 0.035, '#9a958c');
      }
    }
    box(-0.4, 0, 0.18, 0.2, 0.04, '#3b3b40', true);
    box(-0.02, 0, 0.6, 0.54, 0.05, '#ece6da', true);
    box(-0.06, 0.06, 0.34, 0.26, 0.03, '#c9bfae');
    line([[0.28, 0.12], [0.42, 0.12], [0.42, -0.02]], '#7a7670', 0.04);
    dot(0.42, -0.04, 0.05, '#5a5650');
    box(0.14, -0.15, 0.16, 0.13, 0.03, '#fafafa', true);
    dot(0.22, -0.18, 0.025, '#1d4ed8');
    dot(0.22, -0.12, 0.025, '#1d4ed8');
    for (const y of [-0.16, 0.16]) dot(0.31, y, 0.05, '#ffd60a');
  });
}

// Upright landmarks use the same side-view unit space as the rocket: base at y=0, top at y=-1.
function withUprightSpace(cx, baseY, size, draw) {
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw();
  ctx.restore();
}

function outlinedLine(points, color, width) {
  line(points, OUTLINE, width + 0.05);
  line(points, color, width);
}

export function drawFlag(cx, baseY, size, now) {
  withUprightSpace(cx, baseY, size, () => {
    const wave = Math.sin(now / 250) * 0.04;
    outlinedLine([[0, 0], [0, -1]], '#e8eaef', 0.05);
    ctx.beginPath();
    ctx.moveTo(0.03, -0.98);
    ctx.quadraticCurveTo(0.3, -0.98 + wave, 0.6, -0.96);
    ctx.lineTo(0.6, -0.62);
    ctx.quadraticCurveTo(0.3, -0.64 + wave, 0.03, -0.62);
    ctx.closePath();
    ctx.fillStyle = '#ff8c42';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    ctx.stroke();
    dot(0.3, -0.8 + wave / 2, 0.08, '#ffffff');
  });
}

export function drawAntenna(cx, baseY, size, now) {
  withUprightSpace(cx, baseY, size, () => {
    outlinedLine([[-0.25, 0], [0, -0.45], [0.25, 0]], '#9aa1ad', 0.05);
    outlinedLine([[0, 0], [0, -0.55]], '#9aa1ad', 0.05);
    ctx.translate(0, -0.6);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.42, 0.18, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#f1f3f6';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    ctx.stroke();
    line([[0, 0.1], [0, -0.3]], OUTLINE, 0.03);
    dot(0, -0.32, 0.06, Math.floor(now / 600) % 2 ? '#ff3b30' : '#7a1d18');
  });
}

// Floor marks are drawn into the cached maze layer, so they take a context instead of using the shared one.
function disc(g, cx, cy, cr, fill) {
  g.beginPath();
  g.arc(cx, cy, cr, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

// A lumpy circle; `seed` shifts the lumps, `amp` is how far they stick out.
function blob(g, cx, cy, cr, fill, seed, amp = 0.12) {
  g.beginPath();
  for (let k = 0; k <= 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    const rr = cr * (1 + amp * Math.sin(k * 1.9 + seed) + amp * 0.6 * Math.sin(k * 4.3 + seed * 2));
    g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

// Like blob, but with long gentle waves along the edge: worn, soft shapes instead of ragged ones.
// Without `fill` it only leaves the path, to clip by.
export function softBlob(g, cx, cy, cr, fill, seed, amp = 0.08) {
  g.beginPath();
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const rr = cr * (1 + amp * Math.sin(a * 3 + seed) + amp * 0.6 * Math.sin(a * 5 + seed * 2));
    g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  if (!fill) return;
  g.fillStyle = fill;
  g.fill();
}

// An old crater the rover drives across, drawn like the meteor's but worn down: a low soft rim
// in the floor's own light colour (not the walls', or it would read as blocked), a shallow bowl
// shadowed on the side away from the light, a few rocks, faded rays, no meteorite.
export function drawBigCrater(g, x, y, r, p, seed = 0) {
  // On ice the big landmark is a dark hole of open water: a crater would be too pale to spot.
  if (p.polynya) {
    disc(g, x, y, r * 1.15, p.wallBase);
    disc(g, x, y, r * 1.05, p.craterRim);
    disc(g, x, y, r * 0.9, p.polynya);
    disc(g, x - r * 0.3, y - r * 0.3, r * 0.22, '#ffffff40');
    return;
  }
  const rand = mulberry32(seed);
  const phase = rand() * 6;
  const fillOutline = (cx, cy, cr, fill) => softBlob(g, cx, cy, cr, fill, phase, 0.05);
  g.save();
  g.lineCap = 'round';
  g.globalAlpha = 0.45;
  g.strokeStyle = p.craterRim;
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + rand() * 0.6, len = r * (1.45 + rand() * 0.4);
    g.lineWidth = r * (0.06 + rand() * 0.05);
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  g.globalAlpha = 1;
  fillOutline(x + r * 0.06, y + r * 0.08, r * 1.12, 'rgba(0, 0, 0, 0.22)');
  fillOutline(x, y, r * 1.12, p.craterRim);
  fillOutline(x - r * 0.05, y - r * 0.06, r * 1.0, 'rgba(255, 255, 255, 0.18)');
  // The bowl: dark underneath, the floor colour shifted towards the light leaves a shadowed crescent.
  g.save();
  fillOutline(x, y, r * 0.84, null);
  g.clip();
  disc(g, x, y, r, 'rgba(0, 0, 0, 0.4)');
  fillOutline(x + r * 0.2, y + r * 0.22, r * 0.84, p.crater);
  for (let k = 0; k < 3; k++) {
    const a = rand() * Math.PI * 2, d = r * (0.15 + rand() * 0.35), s = r * (0.07 + rand() * 0.05);
    const cx = x + r * 0.1 + Math.cos(a) * d, cy = y + r * 0.1 + Math.sin(a) * d;
    disc(g, cx + s * 0.4, cy + s * 0.5, s, 'rgba(0, 0, 0, 0.3)');
    disc(g, cx, cy, s, p.craterRim);
  }
  g.restore();
  for (let k = 0; k < 2; k++) {
    const a = k * 2.8 + rand(), d = r * 1.08, s = r * (0.13 + rand() * 0.05);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    disc(g, cx, cy, s, 'rgba(0, 0, 0, 0.3)');
    disc(g, cx + s * 0.25, cy + s * 0.3, s * 0.85, p.crater);
  }
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 1 + rand(), d = r * (1.25 + rand() * 0.15);
    disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.05 + rand() * 0.04), p.craterRim);
  }
  g.restore();
}

// A fresh impact crater filling its cell wall to wall: a deep dark bowl, a raised ragged rim
// bulging over the neighbouring walls, cracks running into them, thrown-out dust and rocks,
// and the meteorite still sitting in the middle. Into the maze layer, like drawBigCrater.
// `seed` varies the rays, cracks and rocks between falls.
export function drawImpactCrater(g, x, y, r, p, seed = 0) {
  const rand = mulberry32(seed);
  const rim = k => r * (1.18 + 0.1 * Math.sin(k * 2.7) + 0.05 * Math.sin(k * 7.1));
  g.save();
  g.lineCap = 'round';
  // Dust blanket and rays.
  disc(g, x, y, r * 2.1, 'rgba(0, 0, 0, 0.12)');
  g.strokeStyle = p.craterRim;
  for (let k = 0; k < 11; k++) {
    const a = k * 0.57 + rand() * 0.5, len = r * (1.7 + rand() * 1.1);
    g.lineWidth = r * (0.07 + rand() * 0.06);
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // Cracks into the ground and the walls around.
  g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + rand() * 0.9;
    g.lineWidth = r * 0.05;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15);
    g.lineTo(x + Math.cos(a + 0.25) * r * 1.6, y + Math.sin(a + 0.25) * r * 1.6);
    g.lineTo(x + Math.cos(a + 0.1) * r * 2.0, y + Math.sin(a + 0.1) * r * 2.0);
    g.stroke();
  }
  // Rim: a shadow below, the ragged raised ring, a lit inner edge.
  const ring = (dx, dy, scale, fill) => {
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2, rr = rim(k) * scale;
      g[k ? 'lineTo' : 'moveTo'](x + dx + Math.cos(a) * rr, y + dy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  ring(r * 0.06, r * 0.08, 1, 'rgba(0, 0, 0, 0.35)');
  ring(0, 0, 1, p.wallBase);
  ring(-r * 0.03, -r * 0.05, 0.9, p.wallTop);
  // The bowl: ragged terraces, each a little off-centre, down to the shadowed bottom.
  blob(g, x, y, r * 0.86, p.wallBase, 1);
  blob(g, x + r * 0.1, y + r * 0.12, r * 0.74, p.crater, 2);
  blob(g, x + r * 0.18, y + r * 0.2, r * 0.5, 'rgba(0, 0, 0, 0.35)', 3, 0.18);
  // The meteorite and a few rocks on the rim.
  blob(g, x - r * 0.05, y + r * 0.05, r * 0.3, '#3a3328', 4, 0.2);
  disc(g, x - r * 0.13, y - r * 0.03, r * 0.11, '#6b6050');
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6 + rand(), s = 0.07 + rand() * 0.06;
    disc(g, x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15, r * s, p.wallBase);
  }
  g.restore();
}

// The planet as seen from space on the start screen, in unit space (radius 1): its own surface
// features, hand-placed so the globe is always the same, then light from the top left and an outline.
const GLOBES = {
  moon: p => {
    for (const [x, y, r, k] of [[-0.35, -0.3, 0.36, 1], [0.25, -0.42, 0.24, 2], [0.12, 0.2, 0.3, 3], [-0.45, 0.45, 0.2, 4]]) {
      softBlob(ctx, x, y, r, 'rgba(40, 42, 52, 0.28)', k, 0.14);
    }
    for (const [x, y, r] of [[0.48, 0.32, 0.15], [-0.58, 0.12, 0.1], [0.62, -0.22, 0.08], [-0.12, 0.66, 0.09],
      [0.2, -0.08, 0.06], [-0.2, -0.72, 0.07], [0.42, 0.7, 0.06], [-0.72, -0.35, 0.06], [0.75, 0.15, 0.05]]) {
      globeCrater(x, y, r, p);
    }
  },
  mars: p => {
    for (const [x, y, rx, ry, a, k] of [[-0.3, 0.12, 0.42, 0.2, 0.4, 1], [0.38, -0.12, 0.3, 0.16, -0.3, 2], [0.12, 0.5, 0.26, 0.12, 0.1, 3]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.scale(rx, ry);
      softBlob(ctx, 0, 0, 1, 'rgba(90, 30, 10, 0.35)', k, 0.16);
      ctx.restore();
    }
    // Valles Marineris: one long dark canyon across the middle.
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.18);
    ctx.quadraticCurveTo(-0.1, -0.32, 0.45, -0.38);
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = 'rgba(80, 25, 8, 0.55)';
    ctx.stroke();
    for (const [x, y, r] of [[0.55, 0.3, 0.09], [-0.6, -0.4, 0.07], [-0.15, 0.75, 0.06], [0.7, -0.05, 0.05]]) globeCrater(x, y, r, p);
  },
  europa: () => {
    // Its mark: long reddish-brown lines criss-crossing the ice.
    softBlob(ctx, 0.3, 0.3, 0.35, 'rgba(170, 110, 80, 0.18)', 1, 0.15);
    softBlob(ctx, -0.4, -0.35, 0.28, 'rgba(170, 110, 80, 0.15)', 2, 0.15);
    // Cracks run every which way and break at odd angles, some doubled like Europa's twin ridges,
    // a few with short spurs, so it reads as cracked ice rather than a globe's grid.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(150, 80, 50, 0.6)';
    const stroke = (pts, dx, dy, width) => {
      ctx.beginPath();
      pts.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](x + dx, y + dy));
      ctx.lineWidth = width;
      ctx.stroke();
    };
    [
      [0.04, true, [-0.95, -0.55, 0.1, -0.25, 0.85, 0.45]],
      [0.03, false, [-0.85, 0.65, -0.1, 0.25, 0.55, -0.85]],
      [0.025, false, [-0.25, -0.98, -0.5, -0.3, -0.98, 0.15]],
      [0.03, true, [0.05, 0.98, 0.45, 0.5, 0.98, 0.3]],
      [0.02, false, [0.2, -0.95, 0.65, -0.55, 0.95, -0.1]],
      [0.02, false, [-0.75, 0.2, -0.35, 0.65, -0.55, 0.9]],
    ].forEach(([w, twin, [x0, y0, cx, cy, x1, y1]], n) => {
      const rand = mulberry32(n + 1);
      const pts = crack([[x0, y0], [(x0 + 2 * cx + x1) / 4, (y0 + 2 * cy + y1) / 4], [x1, y1]], rand, 3);
      const len = Math.hypot(x1 - x0, y1 - y0), nx = (y0 - y1) / len, ny = (x1 - x0) / len;
      for (const side of twin ? [-1, 1] : [0]) stroke(pts, nx * w * side, ny * w * side, twin ? w * 0.6 : w);
      for (let b = 0; b < 2; b++) {
        const [bx, by] = pts[2 + Math.floor(rand() * (pts.length - 4))], a = rand() * Math.PI * 2, l = 0.12 + rand() * 0.12;
        stroke(crack([[bx, by], [bx + Math.cos(a) * l, by + Math.sin(a) * l]], rand, 2), 0, 0, w * 0.5);
      }
    });
  },
};

// A crack through the given points: each segment is split again and again, the middle pushed
// sideways at random, so the line breaks at odd angles instead of bending smoothly.
export function crack(points, rand, depth) {
  if (!depth) return points;
  const out = [points[0]];
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1], [bx, by] = points[k];
    const push = (rand() - 0.5) * 0.45;
    out.push([(ax + bx) / 2 + (ay - by) * push, (ay + by) / 2 + (bx - ax) * push], [bx, by]);
  }
  return crack(out, rand, depth - 1);
}

function globeCrater(x, y, r, p) {
  disc(ctx, x, y, r * 1.2, p.craterRim);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  disc(ctx, x, y, r, 'rgba(0, 0, 0, 0.4)');
  disc(ctx, x + r * 0.25, y + r * 0.25, r, p.crater);
  ctx.restore();
}

export function drawGlobe(cx, cy, radius, planet, p) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(radius, radius);
  if (planet === 'mars') {
    const haze = ctx.createRadialGradient(0, 0, 0.95, 0, 0, 1.18);
    haze.addColorStop(0, 'rgba(255, 150, 100, 0.45)');
    haze.addColorStop(1, 'rgba(255, 150, 100, 0)');
    disc(ctx, 0, 0, 1.18, haze);
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  disc(ctx, 0, 0, 1, p.floor);
  GLOBES[planet](p);
  const light = ctx.createRadialGradient(-0.4, -0.45, 0.1, -0.15, -0.15, 1.25);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  light.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  light.addColorStop(0.8, 'rgba(0, 0, 0, 0.18)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  disc(ctx, 0, 0, 1, light);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.lineWidth = 0.08;
  ctx.strokeStyle = p.wallBase;
  ctx.stroke();
  ctx.restore();
}

export function drawPad(cx, cy, cell, now) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, cell * 0.42, cell * 0.14, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2d2f38';
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 214, 10, ${0.5 + 0.4 * Math.sin(now / 300)})`;
  ctx.lineWidth = cell * 0.04;
  ctx.stroke();
}

// Rocket stands upright (side view) in unit space: base at y=0, nose at y=-1.
export function drawRocket(cx, baseY, size, flame, now) {
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(size, size);
  ctx.lineJoin = 'round';

  if (flame) {
    const len = 0.45 + 0.08 * Math.sin(now / 30);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.4, '#ffb703');
    g.addColorStop(1, 'rgba(230, 57, 70, 0)');
    ctx.beginPath();
    ctx.moveTo(-0.11, -0.02);
    ctx.quadraticCurveTo(0, len * 1.1, 0.11, -0.02);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Thick outline: the white body has to stand out even on pale ice.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.04;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.18, -0.38);
    ctx.lineTo(side * 0.36, -0.02);
    ctx.lineTo(side * 0.18, -0.1);
    ctx.closePath();
    ctx.fillStyle = '#e63946';
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-0.1, -0.1);
  ctx.lineTo(0.1, -0.1);
  ctx.lineTo(0.13, 0);
  ctx.lineTo(-0.13, 0);
  ctx.closePath();
  ctx.fillStyle = '#4a4d57';
  ctx.fill();
  ctx.stroke();

  const body = new Path2D();
  body.moveTo(-0.2, -0.1);
  body.lineTo(-0.2, -0.6);
  body.quadraticCurveTo(-0.2, -1, 0, -1);
  body.quadraticCurveTo(0.2, -1, 0.2, -0.6);
  body.lineTo(0.2, -0.1);
  body.closePath();
  const shade = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
  shade.addColorStop(0, '#c4c8d0');
  shade.addColorStop(0.4, '#ffffff');
  shade.addColorStop(1, '#a9aeb8');
  ctx.fillStyle = shade;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-0.25, -1.05, 0.5, 0.27);
  ctx.restore();
  ctx.stroke(body);

  ctx.beginPath();
  ctx.arc(0, -0.5, 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#4cc9f0';
  ctx.fill();
  ctx.lineWidth = 0.035;
  ctx.stroke();

  ctx.restore();
}

export function drawText(text, x, y, size, align, color) {
  ctx.font = `bold ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.15;
  ctx.strokeStyle = '#070a1f';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export const ROVERS = { lunokhod: drawLunokhod, marsRover: drawMarsRover, icebreaker: drawIcebreaker };

// Speaker with a cross: the game runs, but the browser has not allowed sound yet.
export function drawSoundOff(cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(-0.45, -0.15);
  ctx.lineTo(-0.25, -0.15);
  ctx.lineTo(0, -0.4);
  ctx.lineTo(0, 0.4);
  ctx.lineTo(-0.25, 0.15);
  ctx.lineTo(-0.45, 0.15);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineCap = 'round';
  line([[0.15, -0.2], [0.45, 0.2]], '#ff6b6b', 0.1);
  line([[0.15, 0.2], [0.45, -0.2]], '#ff6b6b', 0.1);
  ctx.restore();
}


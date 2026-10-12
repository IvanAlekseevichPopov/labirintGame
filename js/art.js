// Sprites drawn straight onto the main canvas: rovers, landmarks, rocket, text.

import { mulberry32 } from './random.js';

export const OUTLINE = '#1c1e26';
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

// Each planet plants its own flag, `p.flag` in its palette: cloth colour, emblem, and whether it
// waves. On the Moon there is no air, so its flag hangs stiff from a crossbar, like Apollo's. On
// Mars red dust has settled on the cloth; on Europa the pole stands in a snowdrift. A pale pole
// with a ball on top, stuck in a little heap of the planet's ground.
export function drawFlag(cx, baseY, size, now, p) {
  const { cloth, shade, emblem, still, dusty, drift } = p.flag;
  withUprightSpace(cx, baseY, size, () => {
    const wave = still ? 0 : Math.sin(now / 250) * 0.04;
    const ripple = still ? 0.025 : 0;
    ctx.beginPath();
    ctx.ellipse(0.02, 0.01, drift ? 0.24 : 0.16, 0.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    // The pole ends inside the heap, so its round cap never pokes out below.
    outlinedLine([[0, -0.05], [0, -1]], '#e8eaef', 0.05);
    if (dusty) line([[0, -0.05], [0, -0.3]], p.dust, 0.05);
    if (still) outlinedLine([[0, -0.98], [0.62, -0.98]], '#e8eaef', 0.03);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.025;
    dot(0, -1.03, 0.045, '#e8eaef');
    ctx.stroke();
    // The heap the pole is stuck in, drawn over its foot: a little dome lit from the top left,
    // so the pole reads as going into the ground. On Europa it is a bigger snowdrift.
    const [rx, h] = drift ? [0.22, 0.12] : [0.14, 0.09];
    const heap = new Path2D();
    heap.moveTo(-rx, 0);
    heap.bezierCurveTo(-rx * 0.85, -h * 0.8, -rx * 0.35, -h, 0, -h);
    heap.bezierCurveTo(rx * 0.45, -h, rx * 0.9, -h * 0.6, rx, 0);
    heap.ellipse(0, 0, rx, 0.04, 0, 0, Math.PI);
    const lit = ctx.createLinearGradient(-rx, -h, rx * 0.6, 0.03);
    lit.addColorStop(0, drift ? '#ffffff' : p.craterRim);
    lit.addColorStop(1, drift ? '#bcd3e2' : p.crater);
    ctx.fillStyle = lit;
    ctx.fill(heap);
    ctx.stroke(heap);
    const fabric = new Path2D();
    fabric.moveTo(0.03, -0.98);
    fabric.bezierCurveTo(0.2, -0.98 + wave - ripple, 0.4, -0.98 + wave + ripple, 0.6, -0.96);
    fabric.lineTo(0.6, -0.62);
    fabric.bezierCurveTo(0.4, -0.64 + wave + ripple, 0.2, -0.64 + wave - ripple, 0.03, -0.62);
    fabric.closePath();
    ctx.save();
    ctx.clip(fabric);
    ctx.fillStyle = cloth;
    ctx.fill(fabric);
    // A fold of shade across the cloth, and a seam along the pole.
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(0.42, -0.8 + wave / 2, 0.06, 0.25, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(0.03, -1, 0.05, 0.4);
    EMBLEMS[emblem](0.31, -0.8 + wave / 2);
    if (dusty) {
      const dust = ctx.createLinearGradient(0, -0.6, 0, -0.95);
      dust.addColorStop(0, p.dust);
      dust.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = dust;
      ctx.fillRect(0, -1, 0.65, 0.4);
      ctx.globalAlpha = 1;
      for (const [x, y, r] of [[0.12, -0.7, 0.018], [0.5, -0.68, 0.015], [0.4, -0.9, 0.012], [0.2, -0.88, 0.01], [0.55, -0.82, 0.013]]) {
        dot(x, y + wave / 2, r, p.dust);
      }
    }
    ctx.restore();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    ctx.stroke(fabric);
  });
}

const EMBLEMS = {
  // A crescent: a white disc with a bite out of it, open to the upper right.
  crescent(x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 0.1, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(x - 0.2, y - 0.2, 0.4, 0.4);
    ctx.arc(x + 0.06, y - 0.04, 0.085, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill('evenodd');
    ctx.restore();
  },
  // The red planet with a ring of white around it.
  planet(x, y) {
    dot(x, y, 0.11, '#ffffff');
    dot(x, y, 0.08, '#d1462a');
    dot(x - 0.025, y - 0.025, 0.025, '#f08a5d');
  },
  // Six arms, each with a little V near its tip.
  snowflake(x, y) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.022;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      const tx = x + ux * 0.065, ty = y + uy * 0.065;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ux * 0.11, y + uy * 0.11);
      for (const turn of [-0.7, 0.7]) {
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(a + turn) * 0.04, ty + Math.sin(a + turn) * 0.04);
      }
      ctx.stroke();
    }
  },
};

// The tripod's legs meet in a joint right under the tilted dish, so the dish rests on the
// tripod itself. The feed mast starts at the rim, so nothing crosses an outline.
export function drawAntenna(cx, baseY, size, now) {
  withUprightSpace(cx, baseY, size, () => {
    const tilt = -0.4, depth = 0.18, joint = -0.46;
    outlinedLine([[0, -0.06], [0, joint]], '#6f7682', 0.06);
    outlinedLine([[-0.3, 0], [0, joint], [0.3, 0]], '#9aa1ad', 0.06);
    ctx.save();
    ctx.translate(depth * Math.sin(tilt), joint - depth * Math.cos(tilt));
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.42, depth, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#f1f3f6';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.03;
    ctx.stroke();
    line([[0, 0], [0, -0.28]], OUTLINE, 0.03);
    dot(0, -0.32, 0.06, Math.floor(now / 600) % 2 ? '#ff3b30' : '#7a1d18');
    ctx.restore();
    dot(0, joint, 0.085, OUTLINE);
    dot(0, joint, 0.055, '#9aa1ad');
  });
}

// Shape helpers take their context: floor marks draw into the cached maze layer, not the shared one.
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

// An old crater the rover drives across: small, flat and worn — a soft low rim in the floor's own
// light colour and a shallow, faintly shadowed bowl, with floor showing all round it. Nothing
// like the meteor's deep crater with rays and rocks, which blocks the way: the rover has to drive
// through this one.
export function drawBigCrater(g, x, y, r, p, seed = 0) {
  // On ice the big landmark is a dark hole of open water: a crater would be too pale to spot.
  if (p.polynya) {
    disc(g, x, y, r * 1.15, p.wallBase);
    disc(g, x, y, r * 1.05, p.craterRim);
    disc(g, x, y, r * 0.9, p.polynya);
    disc(g, x - r * 0.3, y - r * 0.3, r * 0.22, '#ffffff40');
    return;
  }
  const phase = mulberry32(seed)() * 6;
  const k = r * 0.75;
  const fillOutline = (cx, cy, cr, fill) => softBlob(g, cx, cy, cr, fill, phase, 0.05);
  g.save();
  fillOutline(x, y, k * 1.12, p.craterRim);
  fillOutline(x - k * 0.05, y - k * 0.06, k, 'rgba(255, 255, 255, 0.15)');
  fillOutline(x, y, k * 0.84, null);
  g.clip();
  disc(g, x, y, k, 'rgba(0, 0, 0, 0.18)');
  fillOutline(x + k * 0.15, y + k * 0.17, k * 0.84, p.crater);
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

// The planet as seen from space, in unit space (radius 1): its own surface features, hand-placed
// so the globe is always the same. drawGlobe adds the light and the outline.
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

// Where a crater's floor shifts from its rim, away from the light; set by drawGlobe so the shadow
// stays on the lit side while the globe turns.
let floorShift = [0.25, 0.25];

// Lumpy, and squashed towards the limb the way a crater on a ball is seen from the side.
function globeCrater(x, y, r, p) {
  const d = Math.hypot(x, y), toward = Math.atan2(y, x), seed = x * 17 + y * 31;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(toward);
  ctx.scale(Math.sqrt(Math.max(0.3, 1 - d * d)), 1);
  ctx.rotate(-toward);
  softBlob(ctx, 0, 0, r * 1.2, p.craterRim, seed, 0.12);
  softBlob(ctx, 0, 0, r, null, seed, 0.12);
  ctx.clip();
  disc(ctx, 0, 0, r * 1.3, 'rgba(0, 0, 0, 0.4)');
  softBlob(ctx, r * floorShift[0], r * floorShift[1], r, p.crater, seed, 0.12);
  ctx.restore();
}

// Light from the top left, or with `night` from below, leaving the top in the dark. With `shadow`
// the far side falls into shadow past a terminator (always so at night); without it the day globe
// is only gently shaded. `turn` spins the surface (radians), the light stays put.
const LIGHT = {
  day: { dir: [-Math.SQRT1_2, -Math.SQRT1_2], depth: 0.6 },
  night: { dir: [-0.45, 0.89], depth: 0.88 },
};

export function drawGlobe(cx, cy, radius, planet, p, { turn = 0, night = false, shadow = night } = {}) {
  const { dir: [lx, ly], depth } = LIGHT[night ? 'night' : 'day'];
  const cos = Math.cos(-turn), sin = Math.sin(-turn);
  floorShift = [-(lx * cos - ly * sin) * 0.35, -(lx * sin + ly * cos) * 0.35];
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
  ctx.save();
  ctx.rotate(turn);
  GLOBES[planet](p);
  ctx.restore();
  if (!shadow) disc(ctx, 0, 0, 1, daylight());
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.lineWidth = 0.025;
  ctx.strokeStyle = p.wallBase;
  ctx.stroke();
  // Over the outline too, or the rim would stay lit all round.
  if (shadow) disc(ctx, 0, 0, 1.02, terminator(lx, ly, depth));
  ctx.restore();
}

function daylight() {
  const light = ctx.createRadialGradient(-0.4, -0.45, 0.1, -0.15, -0.15, 1.25);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  light.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  light.addColorStop(0.8, 'rgba(0, 0, 0, 0.18)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  return light;
}

// Lit from the side of (lx, ly): a soft terminator, the far side as dark as `depth`, never black.
function terminator(lx, ly, depth) {
  const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, 2.6);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  light.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
  light.addColorStop(0.5, 'rgba(4, 6, 20, 0.1)');
  light.addColorStop(0.6, `rgba(4, 6, 20, ${depth * 0.89})`);
  light.addColorStop(1, `rgba(4, 6, 20, ${depth})`);
  return light;
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

// Everything the player reads: Russo One, bundled in fonts/ (index.html), round and bold enough
// to read from the sofa. It has a single weight, so no "bold" here, which would fake a heavier one.
export const FONT = '"Russo One", system-ui, sans-serif';

export function drawText(text, x, y, size, align, color) {
  ctx.font = `${size}px ${FONT}`;
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
  // A dark plate under it, so it stays readable over a neighbour planet in the sky.
  ctx.beginPath();
  ctx.roundRect(-0.65, -0.6, 1.3, 1.2, 0.3);
  ctx.fillStyle = 'rgba(7, 10, 31, 0.75)';
  ctx.fill();
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


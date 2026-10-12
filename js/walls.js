// What makes a planet's walls its own, drawn in the maze layer around the plain ragged walls:
// boulders and cracks on Mars' rocky ridges, gloss and sparkles on Europa's ice with snow drifted
// against it. The Moon's walls stay plain. Positions are seeded by level; `skip(x, y)` leaves out
// spots a meteor has blown apart.

import { mulberry32 } from './random.js';

const point = ([x0, y0, x1, y1], t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];

function rock(g, segments, p, cell, ox, oy, half, rand, skip) {
  for (const seg of segments) {
    const [x0, y0, x1, y1] = seg, nx = y0 - y1, ny = x1 - x0;
    // Now and then an angular boulder on the ridge, poking out to one side. Kept rare: walls
    // crowded with them looked harsh.
    for (let k = 0, n = rand() < 0.08 ? 1 : 0; k < n; k++) {
      const [x, y] = point(seg, 0.15 + rand() * 0.7), side = (rand() - 0.5) * half * 1.4;
      if (skip(x, y)) continue;
      const cx = ox + (x + nx * side) * cell, cy = oy + (y + ny * side) * cell, r = cell * half * (0.7 + rand() * 0.5);
      const sides = 5 + Math.floor(rand() * 3);
      const corners = Array.from({ length: sides }, (_, i) => {
        const a = ((i + rand() * 0.6) / sides) * Math.PI * 2;
        return [Math.cos(a) * (0.75 + rand() * 0.35), Math.sin(a) * (0.75 + rand() * 0.35)];
      });
      stone(g, corners, cx + r * 0.15, cy + r * 0.2, r * 1.05, 'rgba(0, 0, 0, 0.3)');
      stone(g, corners, cx, cy, r, p.wallBase);
      stone(g, corners, cx - r * 0.12, cy - r * 0.16, r * 0.68, p.wallTop);
    }
    // Cracks across the ridge's lit top.
    g.strokeStyle = p.wallBase;
    g.lineWidth = cell * 0.018;
    g.lineCap = 'round';
    for (let k = 0, n = 1 + Math.floor(rand() * 2); k < n; k++) {
      const [x, y] = point(seg, 0.1 + rand() * 0.8), lean = (rand() - 0.5) * 0.1;
      if (skip(x, y)) continue;
      const w = half * 0.5;
      g.beginPath();
      g.moveTo(ox + (x - nx * w + lean) * cell, oy + (y - ny * w - lean) * cell);
      g.lineTo(ox + (x + nx * w * 0.2) * cell, oy + (y + ny * w * 0.2 + lean) * cell);
      g.stroke();
    }
  }
}

function stone(g, corners, cx, cy, r, fill) {
  g.beginPath();
  corners.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](cx + x * r, cy + y * r));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function ice(g, segments, cell, ox, oy, rand, skip) {
  g.lineCap = 'round';
  for (const seg of segments) {
    // A gloss streak along part of the top, as if the ice is wet with light.
    const from = rand() * 0.4, to = from + 0.25 + rand() * 0.35;
    const [ax, ay] = point(seg, from), [bx, by] = point(seg, Math.min(to, 0.95));
    if (!skip(ax, ay) && !skip(bx, by)) {
      g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      g.lineWidth = cell * 0.022;
      g.beginPath();
      g.moveTo(ox + ax * cell - cell * 0.02, oy + ay * cell - cell * 0.03);
      g.lineTo(ox + bx * cell - cell * 0.02, oy + by * cell - cell * 0.03);
      g.stroke();
    }
    if (rand() < 0.15) {
      const [x, y] = point(seg, rand());
      if (!skip(x, y)) sparkle(g, ox + x * cell - cell * 0.02, oy + y * cell - cell * 0.03, cell * 0.06);
    }
  }
}

// Snow blown against the walls on the side away from the wind, drawn under the walls so the
// drifts look piled up against them. Long soft mounds, a bit of blue shade on their far side.
function drifts(g, segments, cell, ox, oy, half, rand, skip, wind) {
  for (const seg of segments) {
    if (rand() < 0.35) continue;
    const [x0, y0, x1, y1] = seg, along = Math.atan2(y1 - y0, x1 - x0);
    // Leeward side of this wall: the side the wind blows towards.
    const side = x0 === x1 ? Math.sign(wind[0]) : Math.sign(wind[1]);
    const nx = (y0 - y1) * side, ny = (x1 - x0) * side;
    for (let k = 0, n = 1 + Math.floor(rand() * 2); k < n; k++) {
      const [x, y] = point(seg, 0.2 + rand() * 0.6);
      if (skip(x, y)) continue;
      const len = 0.18 + rand() * 0.2, depth = 0.07 + rand() * 0.06, out = half * 0.8 + depth * 0.5;
      const cx = ox + (x + nx * out) * cell, cy = oy + (y + ny * out) * cell;
      for (const [dx, dy, fill] of [[nx * 0.025, ny * 0.025, 'rgba(46, 85, 112, 0.22)'], [0, 0, '#f7fbfd']]) {
        g.save();
        g.translate(cx + dx * cell, cy + dy * cell);
        g.rotate(along);
        g.scale(len * cell, depth * cell);
        g.beginPath();
        g.arc(0, 0, 1, 0, Math.PI * 2);
        g.fillStyle = fill;
        g.fill();
        g.restore();
      }
    }
  }
}

function sparkle(g, x, y, r) {
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, rr = k % 2 ? r * 0.22 : r;
    g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

// `segments` are wall edges in grid units; `half` is half the wall's width, in cells.
// `under` is drawn before the walls, the rest over them.
export function drawWallDetails(g, segments, p, { cell, ox, oy, half, seed, skip, under }) {
  const rand = mulberry32(seed + (under ? 1 : 0));
  if (p.walls === 'rock' && !under) rock(g, segments, p, cell, ox, oy, half, rand, skip);
  if (p.walls === 'ice' && !under) ice(g, segments, cell, ox, oy, rand, skip);
  if (p.walls === 'ice' && under) {
    const a = rand() * Math.PI * 2;
    drifts(g, segments, cell, ox, oy, half, rand, skip, [Math.cos(a), Math.sin(a)]);
  }
}

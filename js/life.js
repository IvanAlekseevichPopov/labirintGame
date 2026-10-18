// Life in the ocean seen from the side: jellyfish hanging in the water, faintly glowing, and small
// schools of fish going to and fro along a corridor. Decoration only: off the shortest way where
// it can be, small and see-through, never in the way. Each stays inside open water (a jellyfish in
// its cell, a school along its run of cells), so nothing is drawn over a wall. Placed by the
// level's seed, so a level always has its creatures in the same places.

import { levelDistances } from '../level-format.js';
import { mulberry32 } from './random.js';
import { softBlob } from './sprite.js';

// `glow` is how strongly a jellyfish lights the water round it: a hint here, for a night under
// water it would go up.
// `reach` is how far (cells) its light goes in the dark.
const JELLY = { size: 0.3, bob: 0.07, cellsEach: 45, max: 3, apart: 4, glow: 0.18, reach: 1.1 };
const SCHOOL = { minRun: 3, max: 2, fish: [5, 8], length: 0.11, speed: 0.6 };
const JELLY_COLORS = [['205, 180, 255', '240, 225, 255'], ['255, 190, 225', '255, 228, 242'], ['165, 245, 195', '225, 255, 236']];

const key = (x, y) => `${x},${y}`;

// A level can set its jellyfish cells itself (`jellies`); the rest is still up to the seed.
export function placeLife({ maze, start, goal, smokers, landmarks, jellies: pinned = null }, seed) {
  const rand = mulberry32(seed + 4000);
  const { cols, rows, cells } = maze;
  const fromStart = levelDistances(maze, start), fromGoal = levelDistances(maze, goal);
  const path = fromStart.get(key(goal.x, goal.y)).dist;
  const onRoute = (x, y) => (fromStart.get(key(x, y))?.dist ?? Infinity) + (fromGoal.get(key(x, y))?.dist ?? Infinity) === path;
  // Smoke rises from a smoker through the cells over it; a landmark has its cell to itself.
  const busy = new Set([key(start.x, start.y), key(goal.x, goal.y), ...landmarks.map(l => key(l.x, l.y))]);
  for (const s of smokers) for (let y = s.y; y >= Math.max(0, s.y - 1); y--) busy.add(key(s.x, y));

  const free = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!busy.has(key(x, y)) && !onRoute(x, y)) free.push({ x, y });
  const jellies = [];
  const want = Math.min(JELLY.max, Math.max(1, Math.round((cols * rows) / JELLY.cellsEach)));
  const shuffled = free.map(c => [rand(), c]).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  for (const c of pinned ?? shuffled) {
    if (!pinned && jellies.length === want) break;
    if (!pinned && jellies.some(j => Math.abs(j.x - c.x) + Math.abs(j.y - c.y) < JELLY.apart)) continue;
    const [body, rim] = JELLY_COLORS[Math.floor(rand() * JELLY_COLORS.length)];
    jellies.push({ ...c, body, rim, periodMs: 1500 + rand() * 700, bobMs: 5000 + rand() * 3000, phase: rand() * Math.PI * 2 });
  }

  // Runs of cells open to each other left to right, the fewer on the way and the longer the better.
  const runs = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; ) {
      let end = x;
      while (end < cols - 1 && !cells[y][end].right) end++;
      if (end - x + 1 >= SCHOOL.minRun) runs.push({ y, x0: x, x1: end });
      x = end + 1;
    }
  }
  const crowded = r => Array.from({ length: r.x1 - r.x0 + 1 }, (_, k) => r.x0 + k)
    .filter(x => onRoute(x, r.y) || jellies.some(j => j.x === x && j.y === r.y)).length / (r.x1 - r.x0 + 1);
  const schools = runs
    .map(r => ({ ...r, score: crowded(r) - (r.x1 - r.x0) * 0.02 + rand() * 0.1 }))
    .sort((a, b) => a.score - b.score)
    .filter((r, i, all) => all.slice(0, i).every(o => Math.abs(o.y - r.y) > 1))
    .slice(0, SCHOOL.max)
    .map(r => {
      const [lo, hi] = SCHOOL.fish;
      const n = lo + Math.floor(rand() * (hi - lo + 1));
      return {
        y: r.y, x0: r.x0, x1: r.x1, phase: rand(),
        fish: Array.from({ length: n }, () => ({
          dx: (rand() - 0.5) * 0.4, dy: (rand() - 0.5) * 0.32, lagMs: rand() * 500,
          size: 0.8 + rand() * 0.4, wiggle: rand() * Math.PI * 2,
        })),
      };
    });
  return { jellies, schools };
}

export function drawSchools(ctx, { schools }, now, { cell, ox, oy }) {
  for (const s of schools) drawSchool(ctx, s, now, cell, ox, oy);
}

// Where each jellyfish is now, in px, with its colour: what lights the water round it.
export function jellyLights({ jellies }, now, { cell, ox, oy }) {
  return jellies.map(j => ({ ...jellyAt(j, now, cell, ox, oy), color: j.body, r: cell * JELLY.reach }));
}

function jellyAt(j, now, cell, ox, oy) {
  return { x: ox + (j.x + 0.5) * cell, y: oy + (j.y + 0.38 + Math.sin(now / j.bobMs * Math.PI * 2 + j.phase) * JELLY.bob) * cell };
}

export function drawJellies(ctx, { jellies }, now, { cell, ox, oy }) {
  for (const j of jellies) drawJelly(ctx, j, now, cell, ox, oy);
}

// The school's middle along its run, in cells: slows down at each end and turns round.
function schoolX(s, t) {
  const from = s.x0 + 0.5, to = s.x1 + 0.5, span = to - from;
  const u = (t / 1000) * SCHOOL.speed / span + s.phase * 2;
  return { x: from + span * (1 - Math.cos(Math.PI * u)) / 2, facing: Math.sin(Math.PI * u) >= 0 ? 1 : -1 };
}

function drawSchool(ctx, s, now, cell, ox, oy) {
  for (const f of s.fish) {
    const { x, facing } = schoolX(s, now - f.lagMs);
    const fx = ox + (x + f.dx) * cell, fy = oy + (s.y + 0.5 + f.dy + Math.sin(now / 700 + f.wiggle) * 0.03) * cell;
    const len = cell * SCHOOL.length * f.size, tail = Math.sin(now / 90 + f.wiggle) * 0.35;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(facing * len, len);
    ctx.fillStyle = 'rgba(200, 228, 240, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-0.45, 0);
    ctx.lineTo(-0.85, -0.3 + tail * 0.3);
    ctx.lineTo(-0.85, 0.3 + tail * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.55, 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(70, 120, 160, 0.7)';
    ctx.beginPath();
    ctx.ellipse(0, -0.08, 0.45, 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawJelly(ctx, j, now, cell, ox, oy) {
  // Squeezes now and then and rises a little with each squeeze, sinking slowly between.
  const beat = ((now / j.periodMs + j.phase) % 1);
  const squeeze = beat < 0.25 ? Math.sin((beat / 0.25) * Math.PI) : 0;
  const s = cell * JELLY.size;
  const { x: cx, y: cy } = jellyAt(j, now, cell, ox, oy);
  const w = s * (1 - 0.14 * squeeze), h = s * 0.55 * (1 + 0.18 * squeeze);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = JELLY.glow * (0.75 + 0.25 * squeeze);
  ctx.drawImage(softBlob(j.body), cx - s * 1.1, cy - s * 0.9, s * 2.2, s * 2.2);
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${j.rim}, 0.5)`;
  ctx.lineWidth = s * 0.035;
  for (let k = 0; k < 5; k++) {
    const tx = cx + (k / 4 - 0.5) * w * 0.8;
    ctx.beginPath();
    ctx.moveTo(tx, cy);
    for (let t = 0.15; t <= 1; t += 0.15) {
      const sway = Math.sin(now / 400 - t * 4 + k + j.phase) * s * 0.06 * t;
      ctx.lineTo(tx + sway, cy + t * s * (0.95 - 0.15 * squeeze));
    }
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(${j.body}, 0.6)`;
  ctx.lineWidth = s * 0.07;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.08, cy);
    ctx.quadraticCurveTo(cx + side * w * 0.2 + Math.sin(now / 600 + side) * s * 0.06, cy + s * 0.3, cx + side * w * 0.06, cy + s * 0.55);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.bezierCurveTo(cx - w / 2, cy - h * 1.3, cx + w / 2, cy - h * 1.3, cx + w / 2, cy);
  for (let k = 4; k >= 0; k--) ctx.quadraticCurveTo(cx + ((k + 0.5) / 5 - 0.5) * w, cy + h * 0.14, cx + (k / 5 - 0.5) * w, cy);
  ctx.closePath();
  ctx.fillStyle = `rgba(${j.body}, 0.5)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${j.rim}, 0.75)`;
  ctx.lineWidth = s * 0.04;
  ctx.stroke();
  // Four rings round the middle, as on a moon jelly: two dots side by side would read as eyes.
  ctx.strokeStyle = `rgba(${j.rim}, 0.55)`;
  ctx.lineWidth = s * 0.03;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * w * 0.12, cy - h * 0.45 + Math.sin(a) * h * 0.22, w * 0.055, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.2, cy - h * 0.7, w * 0.1, h * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Ice walls on Europa, seen from above, and the ice chips the icebreaker throws off them.
// A wall is a thick glassy block across the passage, brighter and fatter than the maze walls, so
// from the sofa it reads as "this one can go". Drilling bites a pit into the face the rover drills
// from, cracks spread from it, and near the end pieces break off the edges.

import { DRILL_MS, WALL_RATIO } from './config.js';
import { mulberry32 } from './random.js';

// Sizes in cells: half the block along the passage's side (a bit onto the pillars) and across it.
const BLOCK = { halfLength: 0.6, halfThick: 0.85 * WALL_RATIO, bevel: 0.065 };
const COLORS = {
  shadow: 'rgba(20, 60, 90, 0.3)', light: '#eafdff', body: '#4cd2f2', deep: '#1386c2',
  face: '#a2ecfc', faceDeep: '#32b6e6', edge: '#0d4c72',
  streak: 'rgba(255, 255, 255, 0.22)', bubble: 'rgba(255, 255, 255, 0.7)', pit: 'rgba(14, 78, 122, 0.4)',
  rim: '#f2fdff', crack: '#16597f', crackGlow: 'rgba(240, 253, 255, 0.9)', glint: '#ffffff',
};
const CRACK_GROW = 0.35;

const clamp01 = v => Math.max(0, Math.min(1, v));

// The wall's edge between cell corners, [x0, y0, x1, y1] in cells.
export const iceSegment = ({ a, b }) => (a.x !== b.x ? [b.x, a.y, b.x, a.y + 1] : [a.x, b.y, a.x + 1, b.y]);

// The block is drawn in its own frame: u along the wall, v across it, towards cell b. A wall
// between columns swaps the axes, a mirror in the diagonal that keeps top-left top-left, so the
// highlights stay on the lit side either way.
function frame(wall) {
  const [x0, y0, x1, y1] = iceSegment(wall);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, upright: x0 === x1 };
}
const toScreen = (f, u, v) => (f.upright ? [v, u] : [u, v]);
const fromB = ({ from, b }) => (from && from.x === b.x && from.y === b.y ? 1 : -1);
const damageOf = wall => clamp01(wall.drilled / DRILL_MS);
const pitDepth = damage => (damage > 0 ? BLOCK.halfThick * (0.15 + 1.2 * damage ** 1.2) : 0);
const pitHalfWidth = damage => 0.1 + 0.13 * damage;

function seedOf({ a, b }) {
  return (a.x * 7919 + a.y * 104729 + (a.x !== b.x ? 15485863 : 0)) | 0;
}

// What never changes for a wall: its silhouette, cracks, chips and sparkles. Cached per wall
// object, since the game keeps the same objects for the whole level.
const shapes = new WeakMap();

function shapeOf(wall) {
  let shape = shapes.get(wall);
  if (!shape) {
    shape = makeShape(mulberry32(seedOf(wall)));
    shapes.set(wall, shape);
  }
  return shape;
}

function makeShape(rand) {
  const hl = BLOCK.halfLength, ht = BLOCK.halfThick;
  const cut = () => 0.05 + rand() * 0.07;
  const corners = [0, 1, 2, 3].map(() => { const c = cut(); return [c * (0.8 + rand() * 0.6), c]; });
  const [tl, tr, br, bl] = corners;
  const vertices = [
    [-hl + tl[0], -ht], [hl - tr[0], -ht], [hl, -ht + tr[1]], [hl, ht - br[1]],
    [hl - br[0], ht], [-hl + bl[0], ht], [-hl, ht - bl[1]], [-hl, -ht + tl[1]],
  ];
  const outline = [];
  let arc = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [u0, v0] = vertices[i], [u1, v1] = vertices[(i + 1) % vertices.length];
    const len = Math.hypot(u1 - u0, v1 - v0);
    // Clockwise on screen, so the inward normal is the edge turned right.
    const nu = -(v1 - v0) / len, nv = (u1 - u0) / len;
    const steps = Math.max(1, Math.round(len / 0.04));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      outline.push({ u: u0 + (u1 - u0) * t, v: v0 + (v1 - v0) * t, nu, nv, arc: arc + len * t });
    }
    arc += len;
  }
  const phase = [rand(), rand()].map(r => r * Math.PI * 2);
  for (const pt of outline) pt.rough = 0.007 * Math.sin(pt.arc * 11 + phase[0]) + 0.005 * Math.sin(pt.arc * 27 + phase[1]);

  // Pieces that break off late in the drilling: mostly the corners, then somewhere along an edge.
  const cornerArcs = outline.filter((_, i) => i === 0 || outline[i - 1].nu !== outline[i].nu || outline[i - 1].nv !== outline[i].nv).map(p => p.arc);
  const chipAt = [cornerArcs[0], cornerArcs[2], cornerArcs[4], cornerArcs[6], rand() * arc, rand() * arc];
  const chips = chipAt.map((at, i) => ({
    at, width: 0.07 + rand() * 0.07, depth: 0.04 + rand() * 0.06, from: 0.55 + i * 0.07 + rand() * 0.05,
  }));

  // Cracks run from the pit into the block: v grows inwards here and is flipped to the drilled side.
  const cracks = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    let angle = Math.PI / 2 + (rand() - 0.5) * 2.8;
    const points = [[0, 0]];
    for (let k = 0; k < 4; k++) {
      const [u, v] = points[points.length - 1];
      const step = 0.06 + rand() * 0.07;
      points.push([u + Math.cos(angle) * step, v + Math.sin(angle) * step]);
      angle += (rand() - 0.5) * 1;
    }
    const from = (i / count) * 0.55;
    cracks.push({ points, from });
    if (rand() < 0.5) {
      const [u, v] = points[2];
      const turn = angle + (rand() < 0.5 ? -0.8 : 0.8);
      const branch = [[u, v]];
      for (let k = 0; k < 2; k++) {
        const [bu, bv] = branch[branch.length - 1];
        const a = turn + (rand() - 0.5) * 0.6;
        branch.push([bu + Math.cos(a) * 0.06, bv + Math.sin(a) * 0.06]);
      }
      cracks.push({ points: branch, from: from + 0.2 });
    }
  }

  const streaks = [0, 1].map(() => ({ u: -hl * 0.5 + rand() * hl, w: 0.05 + rand() * 0.06 }));
  const bubbles = [0, 1, 2].map(() => ({ u: (rand() - 0.5) * hl * 1.4, v: (rand() - 0.5) * ht, r: 0.012 + rand() * 0.012 }));
  const sparkles = [0, 1].map(i => ({
    u: (i ? 0.15 : -0.35) * hl * 2 * (0.6 + rand() * 0.5), v: (rand() - 0.6) * ht, phase: rand() * Math.PI * 2,
  }));
  return { outline, perimeter: arc, chips, cracks, streaks, bubbles, sparkles };
}

// The silhouette for this much damage, drilled from side `s` (1 = from b).
function silhouette(shape, damage, s) {
  const depth = pitDepth(damage), half = pitHalfWidth(damage);
  const shrink = 1 - 0.06 * clamp01((damage - 0.7) / 0.3);
  return shape.outline.map(pt => {
    let push = pt.rough;
    if (depth && pt.nv * s < 0) {
      const k = 1 - (pt.u / half) ** 2;
      if (k > 0) push += depth * k ** 0.5 * (1 + pt.rough * 20);
    }
    for (const chip of shape.chips) {
      if (damage < chip.from) continue;
      const d = Math.abs(pt.arc - chip.at), wrapped = Math.min(d, shape.perimeter - d);
      push += chip.depth * Math.max(0, 1 - wrapped / chip.width);
    }
    return [(pt.u + pt.nu * push) * shrink, (pt.v + pt.nv * push) * shrink, pt.nu, pt.nv, push];
  });
}

function path(g, points, du = 0, dv = 0) {
  g.beginPath();
  points.forEach(([u, v], i) => (i ? g.lineTo(u + du, v + dv) : g.moveTo(u + du, v + dv)));
  g.closePath();
}

function stroke(g, points, color, width) {
  g.beginPath();
  points.forEach(([u, v], i) => (i ? g.lineTo(u, v) : g.moveTo(u, v)));
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}

// Crack polylines cut to how far they have grown.
function grown(points, part) {
  if (part >= 1) return points;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let left = part * lengths.reduce((a, b) => a + b, 0);
  const out = [points[0]];
  for (let i = 0; i < lengths.length && left > 0; i++) {
    const t = Math.min(1, left / lengths[i]);
    out.push([points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t]);
    left -= lengths[i];
  }
  return out;
}

function sparkle(g, u, v, size) {
  g.beginPath();
  g.moveTo(u - size, v);
  g.quadraticCurveTo(u, v, u, v - size);
  g.quadraticCurveTo(u, v, u + size, v);
  g.quadraticCurveTo(u, v, u, v + size);
  g.quadraticCurveTo(u, v, u - size, v);
  g.fillStyle = COLORS.glint;
  g.fill();
}

// One ice wall. `drilling` shakes it a little while the drill is in it.
export function drawIceWall(g, wall, { cell, ox, oy, now, drilling = false }) {
  const f = frame(wall);
  const shape = shapeOf(wall);
  const damage = wall.from ? damageOf(wall) : 0;
  const s = fromB(wall);
  const hl = BLOCK.halfLength, ht = BLOCK.halfThick;
  const outline = silhouette(shape, damage, s);
  const shake = drilling ? 0.012 * cell : 0;
  const alpha = g.globalAlpha;

  g.save();
  g.translate(ox + f.cx * cell + Math.sin(now * 0.11) * shake, oy + f.cy * cell + Math.cos(now * 0.137) * shake);
  if (f.upright) g.transform(0, 1, 1, 0, 0, 0);
  g.scale(cell, cell);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  path(g, outline, 0.045, 0.045);
  g.fillStyle = COLORS.shadow;
  g.fill();

  const body = g.createLinearGradient(-hl * 0.5, -ht * 1.3, hl * 0.5, ht * 1.3);
  body.addColorStop(0, COLORS.light);
  body.addColorStop(0.45, COLORS.body);
  body.addColorStop(1, COLORS.deep);
  path(g, outline);
  g.fillStyle = body;
  g.fill();

  // The top face, set in from the bevelled rim: lighter top-left, darker bottom-right than the rim.
  const ku = (hl - BLOCK.bevel) / hl, kv = (ht - BLOCK.bevel) / ht;
  const face = g.createLinearGradient(-hl * 0.5, -ht, hl * 0.5, ht);
  face.addColorStop(0, COLORS.face);
  face.addColorStop(1, COLORS.faceDeep);
  path(g, outline.map(([u, v]) => [u * ku, v * kv]));
  g.fillStyle = face;
  g.globalAlpha = alpha * 0.92;
  g.fill();
  g.globalAlpha = alpha;

  path(g, outline);
  g.save();
  g.clip();

  g.fillStyle = COLORS.streak;
  for (const { u, w } of shape.streaks) {
    g.beginPath();
    g.moveTo(u - ht * 0.6, -ht);
    g.lineTo(u - ht * 0.6 + w, -ht);
    g.lineTo(u + ht * 0.6 + w, ht);
    g.lineTo(u + ht * 0.6, ht);
    g.fill();
  }
  g.strokeStyle = COLORS.bubble;
  g.lineWidth = 0.008;
  for (const { u, v, r } of shape.bubbles) {
    g.beginPath();
    g.arc(u, v, r, 0, Math.PI * 2);
    g.stroke();
  }

  if (damage > 0) {
    const depth = pitDepth(damage), half = pitHalfWidth(damage);
    const bottom = s * (ht - depth);
    g.beginPath();
    g.ellipse(0, s * ht, half * 1.5, depth + 0.07, 0, 0, Math.PI * 2);
    g.fillStyle = COLORS.pit;
    g.fill();
    for (const { points, from } of shape.cracks) {
      const part = clamp01((damage - from) / CRACK_GROW);
      if (!part) continue;
      const line = grown(points, part).map(([u, v]) => [u, bottom - s * v]);
      stroke(g, line, COLORS.crackGlow, 0.032);
      stroke(g, line, COLORS.crack, 0.013);
    }
    const rim = outline.filter(([u, , , nv, push]) => push > 0.02 && nv * s < 0 && Math.abs(u) < half).map(([u, v, nu, nv]) => [u + nu * 0.018, v + nv * 0.018]);
    if (rim.length > 1) stroke(g, rim, COLORS.rim, 0.022);
  }

  g.globalAlpha = alpha * 0.9;
  stroke(g, [[-hl + 0.1, -ht + 0.04], [-hl * 0.15, -ht + 0.04]], COLORS.glint, 0.028);
  stroke(g, [[-hl * 0.05, -ht + 0.04], [hl * 0.12, -ht + 0.04]], COLORS.glint, 0.028);
  stroke(g, [[-hl + 0.04, -ht + 0.1], [-hl + 0.04, ht * 0.15]], COLORS.glint, 0.024);
  g.globalAlpha = alpha;

  for (const { u, v, phase } of shape.sparkles) {
    const glow = Math.max(0, Math.sin(now * (Math.PI * 2 / 3600) + phase)) ** 6;
    if (glow > 0.02) sparkle(g, u, v, 0.07 * glow);
  }
  g.restore();

  path(g, outline);
  g.strokeStyle = COLORS.edge;
  g.lineWidth = 0.035;
  g.stroke();
  g.restore();
}

// Where the drill touches the wall and which way is back to the rover, in cells.
function contact(wall) {
  const f = frame(wall), s = fromB(wall);
  const depth = pitDepth(damageOf(wall));
  const [du, dv] = toScreen(f, 0, s * (BLOCK.halfThick - depth * 0.6));
  const [bx, by] = toScreen(f, 0, s);
  return { x: f.cx + du, y: f.cy + dv, bx, by };
}

const CRUMBS = { everyMs: 22, lifeMs: 400, speed: [1, 2.6], fan: 1.1, drag: 6, size: [0.025, 0.05] };
const SHARDS = { count: 26, lifeMs: [600, 800], speed: [0.7, 2.3], drag: 4, size: [0.05, 0.11] };
const CHIP_COLORS = ['#ffffff', '#c9f3ff', '#7fd8f2', '#4fb8e3'];
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

// Ice chips in cells, timed by the game clock like the bubbles: crumbs spray back at the rover
// while it drills, shards fly both ways when a wall gives.
export function createChips() {
  let list = [];
  let nextAt = 0;
  let last = null;
  const add = (x, y, vx, vy, now, life, size, drag) => list.push({
    x, y, vx, vy, born: now, life, size, drag,
    rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 16,
    color: CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)],
  });
  return {
    reset() {
      list = [];
      nextAt = 0;
      last = null;
    },
    update(now, drillingWall) {
      const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      for (const c of list) {
        const slow = Math.exp(-dt * c.drag);
        c.vx *= slow;
        c.vy *= slow;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.spin * dt;
      }
      list = list.filter(c => now - c.born < c.life);
      if (!drillingWall || now < nextAt) return;
      const { x, y, bx, by } = contact(drillingWall);
      const back = Math.atan2(by, bx);
      for (let i = 0; i < 2; i++) {
        const angle = back + (Math.random() - 0.5) * 2 * CRUMBS.fan, speed = between(CRUMBS.speed);
        add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, now,
          CRUMBS.lifeMs * (0.7 + Math.random() * 0.5), between(CRUMBS.size), CRUMBS.drag);
      }
      nextAt = now + CRUMBS.everyMs * (0.6 + Math.random() * 0.8);
    },
    burst(now, wall) {
      const f = frame(wall);
      for (let i = 0; i < SHARDS.count; i++) {
        const side = i % 2 ? 1 : -1;
        const u = (Math.random() - 0.5) * BLOCK.halfLength * 2, v = side * Math.random() * BLOCK.halfThick;
        const [dx, dy] = toScreen(f, u, v);
        const [vx, vy] = toScreen(f, (Math.random() - 0.5) * 1.2, side * between(SHARDS.speed));
        add(f.cx + dx, f.cy + dy, vx, vy, now, between(SHARDS.lifeMs), between(SHARDS.size), SHARDS.drag);
      }
    },
    draw(g, now, { cell, ox, oy }) {
      if (!list.length) return;
      g.save();
      g.lineJoin = 'round';
      g.strokeStyle = COLORS.edge;
      for (const c of list) {
        const t = (now - c.born) / c.life;
        const x = ox + c.x * cell, y = oy + c.y * cell, r = c.size * cell;
        g.globalAlpha = 1 - clamp01((t - 0.5) / 0.5);
        g.beginPath();
        g.moveTo(x + Math.cos(c.rot) * r, y + Math.sin(c.rot) * r);
        g.lineTo(x + Math.cos(c.rot + 2.3) * r * 0.75, y + Math.sin(c.rot + 2.3) * r * 0.75);
        g.lineTo(x + Math.cos(c.rot + 4.1) * r * 0.9, y + Math.sin(c.rot + 4.1) * r * 0.9);
        g.closePath();
        g.fillStyle = c.color;
        g.fill();
        g.lineWidth = Math.max(1, r * 0.22);
        g.stroke();
      }
      g.restore();
    },
  };
}

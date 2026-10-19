// A big crater on the Moon with its floor in shadow: the sun is low and never reaches the bottom,
// so in there the rover sees only by its headlights. The rim is rock (X cells in the map, closed)
// broken by passes; the maze runs on across the floor. Ground tint and rock are drawn once into
// the maze layer (drawCraterGround under the walls, drawCraterRock over them), the shadow is the
// veil on top, like the storm (storm.js) but round.

import { createHeadlights, headlightPreset, radial } from './headlights.js';
import { brightness } from './night.js';
import { clipToMaze, createClock, cutCommon, layerContext, paintCommon } from './veil.js';
import { mulberry32 } from './random.js';
import { LEVEL_DIRS, inShade, levelDistances } from '../level-format.js';

export const SHADE = {
  // As dark as the night (night.js): the maze in there shows only in the headlights.
  dark: '3,4,14',
  density: 0.985,
  // Towards the sun, low in the upper left: it lights the rock faces and throws the rim's shadow.
  sun: [-0.6, -0.8],
  soft: 0.45,       // width of the shadow's soft edge round the floor, cells
  glow: 0.8,        // faint light around the rover, cells
  // How far rock may reach into an open cell next to it, cells past the shared edge.
  overhang: 0.14,
  rock: { dark: [44, 46, 54], lit: [182, 185, 194], line: 'rgba(24, 25, 31, 0.6)' },
};

const toPx = (at, cell) => ({ x, y }) => [at.x + (x + 0.5) * cell, at.y + (y + 0.5) * cell];

// The way into the crater at each pass: its open side onto the floor (on the shortest route from
// the start to the rocket, if more than one). Only that half of a road is drawn: it marks the gap
// in the rim; outside, the maze is lit anyway, and a road out there could point where a meteor later
// shuts the way. Taken from the maze as the level starts.
export function passRoads(shade, maze, start, goal) {
  const key = c => `${c.x},${c.y}`;
  const fromStart = levelDistances(maze, start), toGoal = levelDistances(maze, goal);
  const route = fromStart.get(key(goal)).dist;
  const onRoute = c => fromStart.get(key(c))?.dist + toGoal.get(key(c))?.dist === route;
  return shade.passes.map(p => {
    const len = Math.hypot(p.x - shade.x, p.y - shade.y) || 1;
    const inward = d => -(d.dx * (p.x - shade.x) + d.dy * (p.y - shade.y)) / len;
    const next = d => ({ x: p.x + d.dx, y: p.y + d.dy });
    const ways = LEVEL_DIRS.filter(d => !maze.cells[p.y][p.x][d.wall] && inShade(shade, next(d)))
      .sort((a, b) => (onRoute(next(b)) - onRoute(next(a))) || inward(b) - inward(a));
    return { ...p, way: ways[0] ?? null };
  });
}

// A rover's road from the floor up into each pass, so from the sofa the gap in the rim reads as a
// way through. Under the walls. Drawn on a scrap of canvas and faded out round the pass there.
const ROAD = { reach: 0.9, back: 0.5, width: 0.7, alpha: 0.5, track: 0.18, trackWidth: 0.07, trackAlpha: 0.35 };

function drawPassRoads(g, roads, cell, at) {
  const pos = toPx(at, cell);
  const scale = g.getTransform().a;
  const size = cell * ROAD.reach * 2.2;
  for (const { way, ...p } of roads) {
    if (!way) continue;
    const scrap = document.createElement('canvas');
    scrap.width = scrap.height = Math.ceil(size * scale);
    const o = scrap.getContext('2d');
    o.scale(scale, scale);
    o.translate(size / 2, size / 2);
    // From a little outside the pass's middle down onto the floor, fading out at both ends, so it
    // reads as worn ground and not a capsule lying in the gap.
    const from = -ROAD.back, to = ROAD.reach;
    const at = k => [way.dx * cell * k, way.dy * cell * k];
    o.beginPath();
    o.moveTo(...at(from));
    o.lineTo(...at(to));
    o.lineWidth = cell * ROAD.width;
    o.strokeStyle = `rgba(255,255,255,${ROAD.alpha})`;
    o.stroke();
    o.lineWidth = cell * ROAD.trackWidth;
    o.strokeStyle = `rgba(0,0,0,${ROAD.trackAlpha})`;
    for (const side of [-1, 1]) {
      const [nx, ny] = [way.dy * side * cell * ROAD.track, -way.dx * side * cell * ROAD.track];
      o.beginPath();
      o.moveTo(at(from)[0] + nx, at(from)[1] + ny);
      o.lineTo(at(to)[0] + nx, at(to)[1] + ny);
      o.stroke();
    }
    o.globalCompositeOperation = 'destination-in';
    const fade = o.createLinearGradient(...at(from), ...at(to));
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(0.3, '#000');
    fade.addColorStop(0.6, '#000');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = fade;
    o.fillRect(-size / 2, -size / 2, size, size);
    const [x, y] = pos(p);
    g.drawImage(scrap, x - size / 2, y - size / 2, size, size);
  }
}

// Into the maze layer, before the walls: the floor a shade darker, thrown-out dust round the rim,
// the roads over the passes.
export function drawCraterGround(g, shade, roads, cell, at) {
  const [cx, cy] = toPx(at, cell)(shade);
  const r = shade.r * cell;
  const dust = g.createRadialGradient(cx, cy, r, cx, cy, r + cell * 2.4);
  dust.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  dust.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = dust;
  g.fillRect(cx - r - cell * 3, cy - r - cell * 3, (r + cell * 3) * 2, (r + cell * 3) * 2);
  g.beginPath();
  g.arc(cx, cy, r - cell * 0.4, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0, 0, 0, 0.1)';
  g.fill();
  drawPassRoads(g, roads, cell, at);
}

const mix = (k, { dark, lit }) => `rgb(${dark.map((v, i) => Math.round(v + (lit[i] - v) * k)).join(',')})`;
const sunDir = (() => { const l = Math.hypot(...SHADE.sun); return SHADE.sun.map(v => v / l); })();
// How lit a face is that slopes down towards (dx, dy): from 0.3 turned away from the sun (rock in
// its own shade read as a hole in the ground when darker) to 1 facing it.
const light = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return 0.3 + 0.7 * Math.min(1, Math.max(0, 0.45 + 0.65 * (dx * sunDir[0] + dy * sunDir[1]) / l)); };

// A sharp-edged rock round (x, y) px: a jagged outline and a peak, cut into faces from the peak
// down to each edge, each shaded by which way it slopes.
function rock(g, x, y, size, rand) {
  const n = 7 + Math.floor(rand() * 4);
  const turn = rand() * Math.PI * 2;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = turn + (i + rand() * 0.5) / n * Math.PI * 2;
    const d = size * (0.82 + rand() * 0.3);
    return [x + Math.cos(a) * d, y + Math.sin(a) * d];
  });
  const px = x + (rand() - 0.5) * size * 0.3, py = y + (rand() - 0.5) * size * 0.3;
  g.lineJoin = 'round';
  g.lineWidth = size * 0.05;
  g.strokeStyle = SHADE.rock.line;
  pts.forEach(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % n];
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(ax, ay);
    g.lineTo(bx, by);
    g.closePath();
    g.fillStyle = mix(light((ax + bx) / 2 - px, (ay + by) / 2 - py) * (0.85 + rand() * 0.15), SHADE.rock);
    g.fill();
    g.stroke();
  });
}

// Into the maze layer, over the walls. The rim is one ridge: its outline is the rock cells, each
// reaching only a little into the open cells beside it, and its crest runs along the ring, with
// sharp faces falling away to both sides, lit by which way they face. Loose rocks lie at its
// foot and on the passes. `frame` is the maze's outline in px and its size in cells.
export function drawCraterRock(g, shade, rocks, cell, at, frame, seed) {
  const rand = mulberry32(seed);
  const pos = toPx(at, cell);
  const isRock = (x, y) => rocks.some(r => r.x === x && r.y === y);
  const inMaze = (x, y) => x >= 0 && y >= 0 && x < frame.cols && y < frame.rows;
  const [cx, cy] = pos(shade);
  const ring = shade.r * cell;
  g.save();
  g.beginPath();
  g.roundRect(frame.x, frame.y, frame.w, frame.h, frame.round);
  g.clip();
  // Shadow the rim throws on the ground, away from the sun: one fill, so where the rocks' shadows
  // overlap it doesn't pile up into dark holes, and none on the passes, which keep their road clear.
  const shadows = new Path2D();
  for (const c of rocks) {
    const [x, y] = pos(c);
    const [sx, sy] = [x - sunDir[0] * cell * 0.22, y - sunDir[1] * cell * 0.22];
    shadows.moveTo(sx + cell * 0.66, sy);
    shadows.arc(sx, sy, cell * 0.66, 0, Math.PI * 2);
  }
  const ground = new Path2D();
  ground.rect(frame.x, frame.y, frame.w, frame.h);
  for (const p of shade.passes) ground.rect(at.x + p.x * cell, at.y + p.y * cell, cell, cell);
  g.save();
  g.clip(ground, 'evenodd');
  g.fillStyle = 'rgba(0, 0, 0, 0.18)';
  g.fill(shadows);
  g.restore();
  const band = new Path2D();
  for (const c of rocks) {
    const [x, y] = pos(c);
    // Towards an open cell the rock stops just past the edge; towards rock or the frame it runs on.
    const limit = a => {
      const dx = Math.cos(a), dy = Math.sin(a);
      const nx = c.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0), ny = c.y + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0);
      if (!inMaze(nx, ny) || isRock(nx, ny)) return Infinity;
      // By a pass the rock's edge is broken, so it reads as a gap in the rocks and not a door cut in
      // them, but it only juts out a little: drawn back into the rock, it left bare ground the rover
      // bumped into. Elsewhere the edge wanders too, so the rim along a row of cells is not a ruled line.
      const reach = shade.passes.some(p => p.x === nx && p.y === ny) ? rand() * 0.12 : SHADE.overhang + (rand() - 0.5) * 0.2;
      return cell * (0.5 + reach) / Math.max(Math.abs(dx), Math.abs(dy));
    };
    // Plenty of corners, so a broken edge has some to break; more beside a pass.
    const byPass = shade.passes.some(p => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) === 1);
    const n = (byPass ? 18 : 14) + Math.floor(rand() * 4), turn = rand() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = turn + (i + rand() * 0.5) / n * Math.PI * 2;
      const d = Math.min(cell * (0.78 + rand() * 0.22), limit(a));
      band[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    band.closePath();
  }
  // Stroked under the fill, so only the ridge's outer edge keeps its line.
  g.lineJoin = 'round';
  g.lineWidth = cell * 0.09;
  g.strokeStyle = SHADE.rock.line;
  g.stroke(band);
  g.save();
  g.clip(band);
  // Faces from the crest down each side in two rows, every one its own tilt, so the slopes are
  // broken rock and not a smooth bank.
  const steps = Math.round(Math.PI * 2 * shade.r / 0.45);
  const at2 = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const crest = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i % steps) / steps * Math.PI * 2;
    return { a, r: ring + (rand() - 0.5) * cell * 0.16 };
  });
  crest[steps] = crest[0];
  g.lineWidth = cell * 0.03;
  g.strokeStyle = 'rgba(24, 25, 31, 0.5)';
  for (const side of [1, -1]) {
    const feet = [0.6, 1.5].map(depth => crest.map(({ a }, i) => ({ a: a + (i === steps ? 0 : (rand() - 0.5) * 0.4 / shade.r), r: ring + side * cell * (depth + rand() * 0.3) })));
    feet.forEach(row => { row[steps] = row[0]; });
    const rows = [crest, ...feet];
    for (let k = 0; k < 2; k++) {
      const top = rows[k], low = rows[k + 1];
      for (let i = 0; i < steps; i++) {
        const mid = (top[i].a + top[i + 1].a) / 2 + (i === steps - 1 ? Math.PI : 0);
        const tone = light(Math.cos(mid) * side, Math.sin(mid) * side);
        for (const tri of [[top[i], top[i + 1], low[i + 1]], [top[i], low[i + 1], low[i]]]) {
          g.beginPath();
          tri.forEach(({ a, r }, j) => g[j ? 'lineTo' : 'moveTo'](...at2(a, r)));
          g.closePath();
          g.fillStyle = mix(Math.min(1, Math.max(0, tone * (0.65 + rand() * 0.5) - k * 0.08)), SHADE.rock);
          g.fill();
          // Only some edges are cracks; lines on all of them made it a wire mesh.
          if (rand() < 0.25) g.stroke();
        }
      }
    }
  }
  // The crest catches the light, broken where it dips at a pass.
  const passAngles = shade.passes.map(p => Math.atan2(p.y - shade.y, p.x - shade.x));
  const atPass = a => passAngles.some(p => Math.abs(Math.atan2(Math.sin(a - p), Math.cos(a - p))) * shade.r < 0.75);
  g.beginPath();
  crest.forEach(({ a, r }, i) => g[i && !atPass(a) && !atPass(crest[i - 1].a) ? 'lineTo' : 'moveTo'](...at2(a, r)));
  g.lineWidth = cell * 0.05;
  g.strokeStyle = mix(0.95, SHADE.rock);
  g.stroke();
  g.restore();
  // A few boulders on the ridge.
  for (const c of rocks) {
    if (rand() < 0.4) continue;
    const [x, y] = pos(c);
    const a = rand() * Math.PI * 2, d = cell * 0.35 * rand();
    rock(g, x + Math.cos(a) * d, y + Math.sin(a) * d, cell * (0.12 + rand() * 0.12), rand);
  }
  // Loose rocks at the foot of the rim, pushed into the corners of each open cell so the way
  // through stays clear. None on a pass, which has to read as open road.
  for (let y = 0; y < frame.rows; y++) {
    for (let x = 0; x < frame.cols; x++) {
      // Nor beside one, where the rover drives over the pass and would seem to run them over.
      if (isRock(x, y) || shade.passes.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) <= 1)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRock(x + dx, y + dy))) continue;
      const count = rand() < 0.6 ? 1 + Math.floor(rand() * 2) : 0;
      const [mx, my] = pos({ x, y });
      for (let k = 0; k < count; k++) {
        const sx = rand() < 0.5 ? -1 : 1, sy = rand() < 0.5 ? -1 : 1;
        rock(g, mx + sx * cell * (0.3 + rand() * 0.12), my + sy * cell * (0.3 + rand() * 0.12), cell * (0.06 + rand() * 0.07), rand);
      }
    }
  }
  g.restore();
}

export function createShade(shade, maze, planet) {
  const headlights = createHeadlights(headlightPreset('shade', planet));
  const clock = createClock();

  // Round, over the crater's floor as inShade counts it. Where the floor meets the frame the
  // circle alone left the corners of the floor cells lit, so there the shadow takes the cells
  // whole and runs on past the frame, and the blur of its edge doesn't light the frame's foot.
  // Drawn once per layout: a blur every frame would cost too much on a TV.
  let mask = null, maskKey = '';
  const shadowFor = (layer, cell, area) => {
    const key = [layer.width, layer.height, devicePixelRatio, cell, area.x, area.y].join();
    if (key === maskKey) return mask;
    maskKey = key;
    mask ??= document.createElement('canvas');
    mask.width = layer.width;
    mask.height = layer.height;
    const dpr = devicePixelRatio || 1;
    const m = mask.getContext('2d');
    m.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.filter = `blur(${cell * SHADE.soft * dpr / 2}px)`;
    m.fillStyle = `rgba(${SHADE.dark},${SHADE.density})`;
    m.beginPath();
    const [cx, cy] = toPx(area, cell)(shade);
    m.arc(cx, cy, (shade.r - SHADE.soft / 2) * cell, 0, Math.PI * 2);
    for (let y = 0; y < maze.rows; y++) {
      for (let x = 0; x < maze.cols; x++) {
        const edge = !x || !y || x === maze.cols - 1 || y === maze.rows - 1;
        if (!edge || !inShade(shade, { x, y })) continue;
        const x0 = x ? x : -2, y0 = y ? y : -2;
        const x1 = x === maze.cols - 1 ? x + 3 : x + 1, y1 = y === maze.rows - 1 ? y + 3 : y + 1;
        m.rect(area.x + x0 * cell, area.y + y0 * cell, (x1 - x0) * cell, (y1 - y0) * cell);
      }
    }
    m.fill();
    return mask;
  };

  return function drawShade(ctx, layer, now, scene) {
    const { w, h, cell, area, rover } = scene;
    const dt = clock(now);
    const b = brightness(scene.sinceLightsAt, now);
    const [cx, cy] = toPx(area, cell)(shade);
    const inside = ({ x, y }) => Math.hypot(x - cx, y - cy) < shade.r * cell;

    const g = layerContext(layer);
    g.clearRect(0, 0, w, h);
    g.save();
    clipToMaze(g, scene);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(shadowFor(layer, cell, area), 0, 0);
    g.restore();

    g.globalCompositeOperation = 'destination-out';
    const lit = cutCommon(g, scene, now, { tracks: 0.5, beacon: { r: 0.5, strength: 0.6 }, flame: 0 });
    g.save();
    clipToMaze(g, scene);
    if (rover) radial(g, rover.x, rover.y, cell * SHADE.glow, 0.3 + 0.5 * b);
    headlights.cut(g, scene, b);
    g.restore();
    // A strike, the weather's or a meteor's, lights the floor up for a moment, as at night.
    for (const l of scene.lights) radial(g, l.x, l.y, l.r, l.strength);

    ctx.drawImage(layer, 0, 0, w, h);
    // The rover stays solid in the shadow, so it is never lost on the screen.
    rover?.draw();

    // The warm flash of a strike only shows in the shadow, not in the sun; the beams and the dust
    // in them only where the shadow is whole: on its soft edge, over the pale road of a pass, a
    // beam came out a white paper wedge.
    ctx.save();
    clipToMaze(ctx, scene);
    ctx.beginPath();
    ctx.arc(cx, cy, shade.r * cell, 0, Math.PI * 2);
    ctx.clip();
    for (const l of scene.lights) radial(ctx, l.x, l.y, l.r, 0.35 * l.strength, '255,190,120');
    ctx.beginPath();
    ctx.arc(cx, cy, (shade.r - SHADE.soft) * cell, 0, Math.PI * 2);
    ctx.clip();
    headlights.paint(ctx, scene, b, dt);
    ctx.restore();
    paintCommon(ctx, { ...scene, flame: false }, now, lit.filter(inside), { flame: 0 });
  };
}

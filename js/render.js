// Everything drawn on the canvas: layout, cached maze and track layers, the frame itself.

import { state, roverPos } from './game.js';
import { PLANETS } from './planets.js';
import { BUMP_MS, DIRS, DRILL_MS, DROPPED_LEVELS, ROVER_RATIO, WALL_RATIO, WIN } from './config.js';
import { mulberry32 } from './random.js';
import { createWeather, weatherIntensity } from './weather.js';
import { createNight } from './night.js';
import { createStorm } from './storm.js';
import { FONT, drawPad, drawSoundOff, drawText, useContext } from './art.js';
import { ROVERS } from './rovers.js';
import { drawRocket } from './rockets.js';
import { LANDMARKS } from './landmarks.js';
import { drawMeteor, meteorShake } from './meteor.js';
import { drawLaunchSmoke } from './launch.js';
import { drawGround, makeGround } from './ground.js';
import { drawWallDetails } from './walls.js';
import { drawProps, placeProps } from './props.js';
import { drawNeighbours } from './sky.js';
import { drawTitleScene } from './title.js';
import { drawMuseum } from './finale.js';
import { drawProfile } from './profiles.js';
import { beamPolygon } from './headlights.js';
import { createBubbles } from './bubbles.js';
import { createSilt } from './silt.js';
import { createCaustics, crustCracks, drawFrost, drawGrowths, drawIceCrust, drawPebbles, drawProbe, drawProbeLight, drawRockMass, drawSmoke, drawSmoker, fillWater, wallPaint, wallTint } from './ocean.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
useContext(ctx);
// The maze and the tracks only change on level start or resize (tracks grow), so they are
// drawn once into offscreen layers instead of every frame.
const mazeLayer = document.createElement('canvas');
const trackLayer = document.createElement('canvas');
const veilLayer = document.createElement('canvas');
// Seen from the side: everything that is not open water, so the drone's beam stops at the walls.
const wallMask = document.createElement('canvas');
const waterLayer = document.createElement('canvas');
let drawnTracks = 0;
// The track being laid under the rover and how many of its marks are already on the layer.
let laying = { seg: null, marks: 0 };
let decor = null;
let drawWeather = null;
let drawVeil = null;
let wallsPx = [];
let smokers = [];
let stars = [];

// On a dark level the tracks are pale, so they can glow through the night.
const NIGHT_TRACK = '#9fcbe8';
const STORM_WEATHER = 1.7;
// A planet seen from the side has its ice crust over the maze, this many cells thick.
const CRUST_CELLS = 0.5;
// Room kept over the crust for the rocket standing on the ice; its nose may reach into the header.
const SKY_CELLS = 0.35;
// ...and the rock it is cut into this many cells past its sides and below its floor.
const ROCK_CELLS = { side: 0.45, bottom: 0.55 };
// Only part of the rock under the floor is kept clear of the screen's margin; the rest, and the
// rock at the sides, may run into it.
const ROCK_KEPT = 0.3;
const DRONE_RATIO = 0.82;

const clamp01 = v => Math.max(0, Math.min(1, v));

// Wall edges in grid units, [x0, y0, x1, y1] between cell corners.
function wallSegments({ cols, rows, cells }) {
  const segments = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = cells[y][x];
      if (c.top) segments.push([x, y, x + 1, y]);
      if (c.left) segments.push([x, y, x, y + 1]);
      if (x === cols - 1 && c.right) segments.push([x + 1, y, x + 1, y + 1]);
      if (y === rows - 1 && c.bottom) segments.push([x, y + 1, x + 1, y + 1]);
    }
  }
  return segments;
}

// An ice wall's edge in grid units, as wallSegments gives it; `a` is the top or left cell.
const iceSegment = ({ a, b }) => (a.x !== b.x ? [b.x, a.y, b.x, a.y + 1] : [a.x, b.y, a.x + 1, b.y]);
const sameSegment = (s, t) => s.every((v, i) => v === t[i]);

// Seeded by level, so a level's decorations look the same every time — part of what makes it recognisable.
const lookSeed = () => state.index + DROPPED_LEVELS;

function makeDecor() {
  const { cols, rows } = state.maze;
  const rand = mulberry32(lookSeed() + 1);
  return {
    ground: makeGround(state.planet, rand, cols, rows),
    // Ice walls are drawn on their own, every frame, since drilling changes them.
    walls: wallSegments(state.maze).filter(s => !state.ice.some(w => sameSegment(iceSegment(w), s))),
    props: placeProps(state, lookSeed() + 2000),
  };
}

export function levelChanged(levelCount) {
  decor = makeDecor();
  drone.last = null;
  bubbles.reset();
  silt.reset();
  // A storm level gets the full weather and then some, whatever its number.
  const intensity = state.storm ? STORM_WEATHER : weatherIntensity(state.index + 1, levelCount);
  drawWeather = createWeather(state.planet, intensity);
  drawVeil = state.dark ? createNight(state.planet) : state.storm ? createStorm(state.storm, state.planet) : null;
  sizeVeilLayer();
  buildMazeLayer();
  buildTrackLayer();
}

// The night/storm overlay needs a full-screen layer; plain levels do not pay for it.
function sizeVeilLayer() {
  const want = drawVeil ? canvas.width : 0;
  if (veilLayer.width === want && veilLayer.height === (drawVeil ? canvas.height : 0)) return;
  veilLayer.width = want;
  veilLayer.height = drawVeil ? canvas.height : 0;
}

// A meteor crater appeared: redraw the cached layer.
export function mazeChanged() {
  buildMazeLayer();
}

export function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sizeVeilLayer();
  makeStars();
  if (decor) {
    buildMazeLayer();
    buildTrackLayer();
  }
}

export const cellSize = () => layout().cell;

function layout() {
  const w = innerWidth, h = innerHeight;
  const header = h * 0.1;
  const margin = Math.min(w, h) * 0.05;
  const { cols, rows } = state.maze;
  const side = PLANETS[state.planet].side;
  const crust = side ? CRUST_CELLS : 0;
  const tall = rows + crust + (side ? ROCK_KEPT + SKY_CELLS : 0);
  const cell = Math.min((w - 2 * margin) / cols, (h - header - margin) / tall);
  const ox = (w - cell * cols) / 2;
  const oy = header + (crust + (side ? SKY_CELLS : 0)) * cell + (h - header - margin - cell * tall) / 2;
  return { w, h, header, cell, ox, oy };
}

function buildMazeLayer() {
  mazeLayer.width = canvas.width;
  mazeLayer.height = canvas.height;
  const g = mazeLayer.getContext('2d');
  const dpr = devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { cell, ox, oy } = layout();
  const { cols, rows } = state.maze;
  const p = PLANETS[state.planet];
  const wall = cell * WALL_RATIO;

  const frame = { x: ox - wall / 2, y: oy - wall / 2, w: cell * cols + wall, h: cell * rows + wall };
  const rockSide = ROCK_CELLS.side * cell;
  const crustBox = { x: frame.x - rockSide, w: frame.w + 2 * rockSide, top: oy - CRUST_CELLS * cell, bottom: oy + wall / 2 };
  const cracks = p.side ? crustCracks(lookSeed(), crustBox.x, crustBox.w, cell, ox + (state.goal.x + 0.5) * cell) : [];
  // Seen from the side, the walls are ice up under the crust and rock down by the floor.
  const paint = p.side ? wallPaint(g, p, oy, oy + cell * rows) : { base: p.wallBase, top: p.wallTop };
  if (p.side) drawRockMass(g, p, { frame, side: rockSide, bottom: ROCK_CELLS.bottom * cell, cell, seed: lookSeed(), paint });
  g.save();
  g.beginPath();
  g.roundRect(frame.x, frame.y, frame.w, frame.h, wall);
  if (p.side) {
    g.clip();
    fillWater(g, p, { ...frame, cell, surface: crustBox.bottom, cracks });
  } else {
    g.fillStyle = p.floor;
    g.fill();
    g.clip();
    drawGround(g, decor.ground, p, cell, ox, oy, innerWidth, innerHeight);
  }
  const floorMarks = state.landmarks.filter(l => !LANDMARKS[l.type].upright);
  const drawMark = l => LANDMARKS[l.type].draw(g, ox + (l.x + 0.5) * cell, oy + (l.y + 0.5) * cell, cell * (LANDMARKS[l.type].size ?? 0.4), p, l.seed ?? l.x * 31 + l.y * 17);
  for (const l of floorMarks.filter(l => l.type !== 'impact')) drawMark(l);
  g.restore();

  // Meteor impacts bend the walls around them outwards and knock pieces out of them; the walls
  // the crater adds to the maze are not drawn, the crater itself has to look impassable. The
  // outer frame is left alone, it is the edge of the world.
  const impacts = floorMarks.filter(l => l.type === 'impact').map(l => ({ x: l.x + 0.5, y: l.y + 0.5, seed: l.seed ?? 0 }));
  const ragged = (halfWidth, amp, dx = 0, dy = 0) =>
    decor.walls.map(seg => {
      const frame = isFrame(seg, cols, rows);
      return raggedWall(seg, halfWidth, (x, y) => amp * (frame ? 1 : 1 + 2 * blastAt([x, y], impacts)), lookSeed())
        .map(([x, y]) => (frame ? [x + dx, y + dy] : blastDeform([x + dx, y + dy], impacts)))
        .map(([x, y]) => [ox + x * cell, oy + y * cell]);
    });
  const half = WALL_RATIO / 2;
  wallsPx = [...decor.walls, ...state.ice.map(iceSegment)].map(([x0, y0, x1, y1]) => [ox + x0 * cell, oy + y0 * cell, ox + x1 * cell, oy + y1 * cell]);
  const rough = p.wallRough ?? 1;
  const details = { cell, ox, oy, half, seed: lookSeed() + 1000, skip: (x, y) => blastAt([x, y], impacts) > 0 };
  fillShapes(g, ragged(half, 0.03 * rough, 0.02, 0.04), 'rgba(0, 0, 0, 0.35)');
  g.save();
  g.beginPath();
  g.rect(ox, oy, cell * cols, cell * rows);
  g.clip();
  drawWallDetails(g, decor.walls, p, { ...details, under: true });
  g.restore();
  fillShapes(g, ragged(half, 0.03 * rough), paint.base);
  if (p.side) {
    wallMask.width = canvas.width;
    wallMask.height = canvas.height;
    const m = wallMask.getContext('2d');
    m.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.fillRect(0, 0, innerWidth, innerHeight);
    m.globalCompositeOperation = 'destination-out';
    m.beginPath();
    m.roundRect(ox - wall / 2, oy + wall / 2, cell * cols + wall, cell * rows, wall);
    m.fill();
    m.globalCompositeOperation = 'source-over';
    fillShapes(m, ragged(half, 0.03 * rough), '#000');
    caustics.shape({ x: ox - wall / 2, w: cell * cols + wall, surface: oy + wall / 2, h: cell * rows }, wallMask);
  } else {
    // Nothing reads it away from the water; on a 4K screen it would hold on to ~30 MB.
    wallMask.width = wallMask.height = 0;
  }
  fillShapes(g, ragged(half * 0.45, 0.015 * rough, -0.008, -0.016), paint.top);
  drawWallDetails(g, decor.walls, p, details);
  // Rays and rubble stay on the ground, never on the sky.
  g.save();
  g.beginPath();
  g.roundRect(ox - wall / 2, oy - wall / 2, cell * cols + wall, cell * rows + wall, wall);
  g.clip();
  for (const c of impacts) {
    knockOutWalls(g, c, cell, ox, oy, p, cols, rows);
    drawMark({ type: 'impact', x: c.x - 0.5, y: c.y - 0.5, seed: c.seed });
  }
  g.restore();
  if (p.side) {
    drawFrost(g, p, decor.walls, { cell, ox, oy, rows, seed: lookSeed() });
    const clear = (x, y) => state.smokers.some(s => s.x === x && s.y === y);
    drawGrowths(g, p, decor.walls, { cell, ox, oy, cols, rows, half: wall / 2, seed: lookSeed(), clear });
    smokers = state.smokers.map((s, i) => ({ ...drawSmoker(g, p, { x: ox + (s.x + 0.5) * cell, line: oy + (s.y + 1) * cell, half: wall / 2, cell, white: s.white }), seed: i }));
    const pebblesOff = smokers.filter((_, i) => state.smokers[i].y === rows - 1).map(m => m.x);
    drawPebbles(g, p, { x: ox, w: cell * cols, floor: oy + cell * rows - wall / 2, cell, seed: lookSeed(), clear: pebblesOff });
    drawIceCrust(g, p, { ...crustBox, cell, seed: lookSeed(), cracks, hole: ox + (state.goal.x + 0.5) * cell });
  }
}

// A placeholder look: a pale blue block, cracking more the longer it has been drilled.
function drawIce(cell, ox, oy) {
  const thick = cell * WALL_RATIO * 1.4;
  for (const w of state.ice) {
    const [x0, y0, x1, y1] = iceSegment(w);
    const along = x0 === x1 ? [0, 1] : [1, 0];
    const cx = ox + (x0 + x1) / 2 * cell, cy = oy + (y0 + y1) / 2 * cell;
    const [bw, bh] = along[0] ? [cell + thick * 0.4, thick] : [thick, cell + thick * 0.4];
    ctx.fillStyle = 'rgba(170, 225, 250, 0.95)';
    ctx.strokeStyle = '#2b78a8';
    ctx.lineWidth = cell * 0.03;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, thick * 0.3);
    ctx.fill();
    ctx.stroke();
    const cracks = Math.ceil((w.drilled / DRILL_MS) * 6);
    ctx.beginPath();
    for (let k = 0; k < cracks; k++) {
      const a = k * 2.4 + 0.5;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * bw * 0.45, cy + Math.sin(a) * bh * 0.45);
    }
    ctx.stroke();
  }
}

// How far (cells) a blast reaches into the walls, and how much it pushes them at the crater's edge.
export const BLAST = { reach: 1.7, push: 0.16 };

const isFrame = ([x0, y0, x1, y1], cols, rows) =>
  (x0 === x1 && (x0 === 0 || x0 === cols)) || (y0 === y1 && (y0 === 0 || y0 === rows));

// 1 at an impact, fading to 0 at BLAST.reach; smooth, so touching wall segments still line up.
export function blastAt([x, y], impacts) {
  let k = 0;
  for (const c of impacts) k = Math.max(k, 1 - Math.min(1, Math.hypot(x - c.x, y - c.y) / BLAST.reach));
  return k;
}

// Pushes a wall point (grid units) away from every nearby impact, more the closer it is.
export function blastDeform([x, y], impacts) {
  for (const c of impacts) {
    const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
    if (!d || d >= BLAST.reach) continue;
    const k = (1 - d / BLAST.reach) ** 2 * BLAST.push * (0.8 + 0.4 * wallNoise(x * 9, y * 9, c.x));
    x += dx / d * k;
    y += dy / d * k;
  }
  return [x, y];
}

// Floor-coloured bites out of the walls next to the crater, and the knocked-out rubble lying about.
// A bite is shallower than half the wall, so the wall never looks broken through.
function knockOutWalls(g, c, cell, ox, oy, p, cols, rows) {
  const cx = ox + c.x * cell, cy = oy + c.y * cell;
  const bites = decor.walls.filter(seg => !isFrame(seg, cols, rows)).flatMap(([x0, y0, x1, y1]) => {
    const pts = [];
    for (let t = 0.15; t < 1; t += 0.35) {
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const d = Math.hypot(x - c.x, y - c.y);
      if (d > 0.45 && d < 1.1 && wallNoise(x * 13, y * 13, c.y + c.seed) > -0.2) pts.push({ x, y, d });
    }
    return pts;
  });
  g.fillStyle = p.floor;
  for (const b of bites) {
    // Bitten from the crater's side: the bite's centre sits on the wall's face, not its middle.
    const towards = Math.atan2(c.y - b.y, c.x - b.x);
    const bx = ox + (b.x + Math.cos(towards) * WALL_RATIO * 0.5) * cell, by = oy + (b.y + Math.sin(towards) * WALL_RATIO * 0.5) * cell;
    const r = cell * WALL_RATIO * (0.3 + 0.15 * (1.1 - b.d));
    g.beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI * 2, rr = r * (1 + 0.35 * wallNoise(b.x * 31 + k, b.y * 31, c.x));
      g[k ? 'lineTo' : 'moveTo'](bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  for (let k = 0; k < 10; k++) {
    const a = k * 0.63 + 0.4 + wallNoise(k, c.seed, 1), d = cell * (0.85 + 0.6 * (0.5 + 0.5 * wallNoise(k, c.x, c.y + c.seed)));
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = cell * (0.035 + 0.03 * (k % 3));
    g.fillStyle = k % 3 ? p.wallBase : p.wallTop;
    g.beginPath();
    g.moveTo(x - r, y - r * 0.6);
    g.lineTo(x + r * 0.9, y - r);
    g.lineTo(x + r, y + r * 0.7);
    g.lineTo(x - r * 0.7, y + r);
    g.closePath();
    g.fill();
  }
}

// Cheap deterministic noise in [-1, 1] for a grid-unit point; shared by touching walls,
// so ragged edges line up where segments meet.
function wallNoise(x, y, salt) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

// Outline of one wall segment with a ragged edge on both sides and roughly round ends.
// `ampAt(x, y)` gives the raggedness at a point, so it can grow smoothly towards a crater.
function raggedWall([x0, y0, x1, y1], halfWidth, ampAt, salt) {
  const STEPS = 6;
  const nx = y0 - y1, ny = x1 - x0;
  const side = sign => Array.from({ length: STEPS + 1 }, (_, k) => {
    const t = k / STEPS, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const w = halfWidth + ampAt(x, y) * wallNoise(x * STEPS, y * STEPS, salt + sign);
    return [x + nx * w * sign, y + ny * w * sign];
  });
  const cap = (cx, cy, from) => Array.from({ length: 5 }, (_, k) => {
    const a = from - (k + 1) * Math.PI / 6;
    const w = halfWidth + ampAt(cx, cy) * wallNoise(cx * 7 + k, cy * 7, salt);
    return [cx + Math.cos(a) * w, cy + Math.sin(a) * w];
  });
  const angle = Math.atan2(ny, nx);
  return [...side(1), ...cap(x1, y1, angle), ...side(-1).reverse(), ...cap(x0, y0, angle + Math.PI)];
}

function fillShapes(g, shapes, color) {
  g.fillStyle = color;
  for (const pts of shapes) {
    g.beginPath();
    pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
    g.closePath();
    g.fill();
  }
}

const TRACK_MARKS = 5;

// Draws the segment's marks from `from` up to the rover's progress `upTo` along it (0..1);
// returns how many are on the layer now.
function drawTrack(g, { a, b }, cell, ox, oy, from = 0, upTo = 1) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const along = cell * 0.07, across = cell * 0.13;
  const [w, h] = dx ? [along, across] : [across, along];
  let i = from;
  for (; i < TRACK_MARKS && i / TRACK_MARKS <= upTo; i++) {
    const t = i / TRACK_MARKS;
    for (const side of [-0.3, 0.3]) {
      const x = ox + (a.x + 0.5 + dx * t - dy * side) * cell;
      const y = oy + (a.y + 0.5 + dy * t + dx * side) * cell;
      g.fillRect(x - w / 2, y - h / 2, w, h);
    }
  }
  return i;
}

function buildTrackLayer() {
  trackLayer.width = canvas.width;
  trackLayer.height = canvas.height;
  drawnTracks = 0;
  laying = { seg: null, marks: 0 };
  drawNewTracks();
}

// Marks go down as the rover passes over them, so the track grows right behind it. The rover
// is drawn on top, so a mark never shows ahead of it.
function drawNewTracks(now) {
  const g = trackLayer.getContext('2d');
  const dpr = devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = state.dark ? NIGHT_TRACK : PLANETS[state.planet].track;
  const { cell, ox, oy } = layout();
  const lay = (seg, upTo) => {
    if (laying.seg !== seg) laying = { seg, marks: 0 };
    laying.marks = drawTrack(g, seg, cell, ox, oy, laying.marks, upTo);
  };
  for (; drawnTracks < state.tracks.length; drawnTracks++) lay(state.tracks[drawnTracks], 1);
  const seg = state.pendingTrack;
  if (seg && now !== undefined) {
    const p = roverPos(now);
    lay(seg, (p.x - seg.a.x) * (seg.b.x - seg.a.x) + (p.y - seg.a.y) * (seg.b.y - seg.a.y));
  }
}

function makeStars() {
  stars = Array.from({ length: Math.round(innerWidth * innerHeight / 3000) }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 0.3 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  }));
}

// `planet`, if given, brings its neighbour into the sky.
function drawSky(now, w, h, planet) {
  ctx.fillStyle = '#070a1f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    ctx.globalAlpha = 0.5 + 0.45 * Math.sin(now / 700 + s.phase);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (planet) drawNeighbours(ctx, planet, w, h);
}

export function render(now, { soundOff = false } = {}) {
  const planet = PLANETS[state.planet];
  const { w, h, header, cell, ox, oy } = layout();
  const toPx = p => [ox + (p.x + 0.5) * cell, oy + (p.y + 0.5) * cell];
  const winT = state.wonAt === null ? null : now - state.wonAt;

  drawSky(now, w, h, state.planet);
  const [shakeX, shakeY] = meteorShake(state.meteor, now, cell);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.drawImage(mazeLayer, 0, 0, w, h);
  if (planet.side) {
    caustics.draw(ctx, now, cell);
    for (const m of smokers) {
      drawInWater({ x: m.x - cell, y: m.y - cell * 1.4, w: cell * 2, h: cell * 1.6 }, g => drawSmoke(g, [m], now, cell));
    }
  } else {
    drawNewTracks(now);
    ctx.drawImage(trackLayer, 0, 0, w, h);
    drawIce(cell, ox, oy);
  }

  for (const l of state.landmarks.filter(l => LANDMARKS[l.type].upright)) {
    const [lx, ly] = toPx(l);
    // Seen from the side it stands on the floor of its cell, kept low enough to swim over.
    if (planet.side) LANDMARKS[l.type].draw(lx, oy + (l.y + 1 - WALL_RATIO / 2) * cell, cell * 0.45, now, planet);
    else LANDMARKS[l.type].draw(lx, ly + cell * 0.3, cell * 0.75, now, planet);
  }
  drawProps(ctx, decor.props, toPx, cell, now, planet);

  const [gx, gy] = toPx(state.goal);
  // Seen from the side the rocket stands on the ice, and lets a probe down to the goal on a cable.
  const surface = oy - CRUST_CELLS * cell;
  const padY = planet.side ? surface + cell * 0.04 : gy + cell * 0.32;
  if (!planet.side) drawPad(gx, padY, cell, now);

  const flame = winT !== null && winT >= WIN.ignite;
  const shake = flame && winT < WIN.lift ? (Math.random() - 0.5) * cell * 0.04 : 0;
  const liftShare = t => clamp01((t - WIN.lift) / WIN.liftMs);
  const climb = padY + cell * 2;
  const liftAt = t => liftShare(t) ** 2 * climb;
  const liftT = winT === null ? 0 : liftShare(winT);
  const lift = liftAt(winT ?? 0);
  drawRocket(ctx, gx + shake, padY - lift, cell * 0.95, flame, now, planet);
  drawLaunchSmoke(ctx, winT, {
    x: gx, padY, cell, climb, palette: planet,
    area: planet.side
      ? { x: 0, y: padY - cell * 1.5, w, h: cell * 1.6 }
      : { x: ox, y: oy, w: cell * state.maze.cols, h: cell * state.maze.rows },
  });
  if (planet.side) {
    // Once the drone is in, the probe is reeled up through the ice before the rocket lifts off.
    const docked = WIN.shrinkStart + WIN.shrinkMs;
    const reel = winT === null ? 0 : clamp01((winT - docked) / (WIN.lift - docked - 50));
    // Hung a little low in its cell, so the beacon on top clears the ice.
    const hang = gy + cell * 0.1, probeY = hang + (padY - hang) * reel * reel, fade = 1 - clamp01((reel - 0.8) / 0.2);
    drawInWater({ x: gx - cell, y: probeY, w: cell * 2, h: cell * 1.2 }, g => drawProbeLight(g, gx, probeY, cell, now, fade), 'lighter');
    drawProbe(ctx, gx, probeY, padY, cell, now, fade);
  }

  const shrink = winT === null ? 1 : 1 - clamp01((winT - WIN.shrinkStart) / WIN.shrinkMs);
  let rover = null;
  const d = planet.side ? followDrone(now, roverPos(now)) : null;
  if (d) {
    const size = cell * DRONE_RATIO, { screw, back } = screwOf(d, now, size, cell);
    const swimming = Math.hypot(d.vx, d.vy) > 0.3 && shrink >= 1;
    const floor = ledgeUnder(screw.x, d.y + 0.5);
    silt.update(now, { floor, wash: screw.x, back, stirring: swimming, ...siltColors(planet, floor) });
    drawInWater(silt.bounds({ cell, ox, oy }), g => silt.draw(g, now, { cell, ox, oy }));
    bubbles.update(now, { screw, back, swimming, active: shrink >= 1 });
    drawInWater(bubbles.bounds({ cell, ox, oy }), g => bubbles.draw(g, now, { cell, ox, oy }));
  }
  if (shrink > 0) {
    const [rx, ry] = toPx(roverPos(now));
    const bumpT = state.bump ? (now - state.bump.at) / BUMP_MS : 1;
    const nudge = bumpT < 1 ? Math.sin(Math.PI * bumpT) * cell * 0.1 : 0;
    const { dx, dy } = state.bump ? DIRS[state.bump.dir] : DIRS.right;
    if (d) {
      rover = { x: ox + (d.x + 0.5) * cell + dx * nudge, y: oy + (d.y + 0.5) * cell + dy * nudge, angle: state.angle, size: cell * DRONE_RATIO * shrink };
      rover.draw = () => drawDrone(rover, d, now);
    } else {
      rover = { x: rx + dx * nudge, y: ry + dy * nudge, angle: state.angle, size: cell * ROVER_RATIO * shrink };
      rover.draw = () => ROVERS[planet.rover].top(rover.x, rover.y, rover.angle, rover.size);
    }
    rover.draw();
  }

  drawMeteor(ctx, state.meteor, now, cell, toPx);
  // The shake stops here: the veil, the weather and the title stay put (the lights drift from the
  // rover by at most a twentieth of a cell, not worth the cost of shaking the layer too).
  ctx.restore();

  if (drawVeil) {
    drawVeil(ctx, veilLayer, now, {
      w, h, cell, walls: wallsPx, rover, flame, launch: liftT, trackLayer,
      area: { x: ox, y: oy, w: cell * state.maze.cols, h: cell * state.maze.rows, cols: state.maze.cols },
      goal: { x: gx, y: padY - cell * 0.4 - lift },
      landmarks: state.landmarks.map(l => { const [x, y] = toPx(l); return { type: l.type, x, y }; }),
      sinceLightsAt: now - state.lightsAt,
      lights: drawWeather?.lights(cell) ?? [],
    });
  }
  drawText(`${planet.name} — уровень ${state.index + 1}`, ox, header / 2, header * 0.45, 'left', '#ffffff');

  if (drawWeather) {
    const area = { x: ox, y: oy, w: cell * state.maze.cols, h: cell * state.maze.rows, cell };
    // Under water the weather sinks through the water, never over a wall.
    if (planet.side) drawInWater(area, g => drawWeather(g, now, { w, h }, area));
    else drawWeather(ctx, now, { w, h }, area);
  }
  if (soundOff) drawSoundOff(w - header * 0.7, header / 2, header * 0.5);
}

// The drone swims rather than drives: it trails its cell on a soft spring, so it eases off, glides
// a touch past the cell and settles back; it pitches with the climb,
// turns round to face the way it goes, and bobs in place. Drawing only — the rules stay on the grid.
const drone = { x: 0, y: 0, vx: 0, vy: 0, pitch: 0, facing: 1, turn: 1, prop: 0, last: null };
const bubbles = createBubbles();
const silt = createSilt();
const caustics = createCaustics();
// At full speed it trails ~0.2 cell behind, and on stopping glides ~0.07 cell past and back.
const SPRING = { k: 700, c: 24 };

function followDrone(now, target) {
  const dir = Math.cos(state.targetAngle);
  if (drone.last === null || Math.hypot(target.x - drone.x, target.y - drone.y) > 1.5) {
    Object.assign(drone, { ...target, vx: 0, vy: 0, pitch: 0, facing: dir < 0 ? -1 : 1, last: now });
    drone.turn = drone.facing;
  }
  const dt = Math.min(0.05, Math.max(0, (now - drone.last) / 1000));
  drone.last = now;
  // In steps of at most 1/120 s: one big step per frame swings the spring wider and wider once a
  // TV drops to ~20 fps.
  for (let n = Math.ceil(dt * 120), k = 0; k < n; k++) {
    const h = dt / n;
    drone.vx += (SPRING.k * (target.x - drone.x) - SPRING.c * drone.vx) * h;
    drone.vy += (SPRING.k * (target.y - drone.y) - SPRING.c * drone.vy) * h;
    drone.x += drone.vx * h;
    drone.y += drone.vy * h;
  }
  if (dir > 0.5) drone.facing = 1;
  if (dir < -0.5) drone.facing = -1;
  drone.turn += Math.sign(drone.facing - drone.turn) * Math.min(Math.abs(drone.facing - drone.turn), dt * 5);
  const clampTo = (v, m) => Math.max(-m, Math.min(m, v));
  const want = clampTo(drone.vy * 0.09, 0.4);
  drone.pitch += (want - drone.pitch) * Math.min(1, dt * 10);
  const speed = Math.hypot(drone.vx, drone.vy);
  drone.prop += dt * (speed > 0.3 ? 2.2 : 0.5);
  return drone;
}

// Turning round it narrows a little, then shows itself head-on for a moment and comes out facing
// the other way; squeezed any thinner it would turn into a flat cut-out.
const HEAD_ON = 0.35;
// The machine that swims here, from rovers.js.
const swimmer = () => ROVERS[PLANETS[state.planet].rover];
// The propeller in the drone's own space (see PROFILES.drone).
const SCREW = { x: -0.47, y: -0.27 };

const headOn = d => Math.abs(d.turn) < HEAD_ON;
const sideways = d => Math.sign(d.turn) * (0.7 + 0.3 * (Math.abs(d.turn) - HEAD_ON) / (1 - HEAD_ON));
const bob = (now, size) => Math.sin(now / 700) * size * 0.03;

// Silt takes the colour of the walls where it is stirred up: icy and pale up under the crust, dark
// rock down by the sea floor. The murk sits between the walls' shade and their lit top, the grains
// a touch lighter than the lit top so they catch the eye.
function siltColors(p, floor) {
  if (floor === null) return {};
  const { base, top } = wallTint(p, floor / state.maze.rows);
  const toward = (from, to, k) => from.map((v, i) => Math.round(v + (to[i] - v) * k)).join(', ');
  return { murk: toward(base, top, 0.6), grain: toward(top, [255, 255, 255], 0.3) };
}

// The top of the floor under (x, y) in cells, if the cell there has a wall below it; else null.
function ledgeUnder(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  const c = state.maze.cells[cy]?.[cx];
  return c?.bottom ? cy + 1 - WALL_RATIO / 2 : null;
}

// Where the propeller is, in cells, and which way it blows: the drawing's turn, pitch and bob
// applied to SCREW. Head-on the screw is hidden behind the hull, so bubbles come from its middle.
function screwOf(d, now, size, cell) {
  const [lx, ly] = headOn(d) ? [0, 0.03 * size] : [(SCREW.x + 0.06) * size, (SCREW.y + 0.3) * size];
  const k = headOn(d) ? 1 : sideways(d), c = Math.cos(d.pitch), s = Math.sin(d.pitch);
  const wx = k * (lx * c - ly * s), wy = lx * s + ly * c + bob(now, size);
  return { screw: { x: d.x + 0.5 + wx / cell, y: d.y + 0.5 + wy / cell }, back: -Math.sign(d.turn) || -1 };
}

function drawDrone({ x, y, size }, d, now) {
  if (size <= 0) return;
  y += bob(now, size);
  if (!headOn(d)) drawLampBeam(d, x, y, size);
  ctx.save();
  ctx.translate(x, y);
  if (headOn(d)) {
    drawProfile(ctx, swimmer().front, 0, size * 0.3, size);
    ctx.restore();
    return;
  }
  ctx.scale(sideways(d), 1);
  ctx.rotate(d.pitch);
  ctx.translate(size * 0.06, size * 0.3);
  drawProfile(ctx, swimmer().profile, 0, 0, size, { rolled: d.prop });
  ctx.restore();
}

// The bow lamp's beam, cast against the walls like the headlights at night and then cut by the
// wall mask, so it lights the water up to a wall and never shows on or past it.
function drawLampBeam(d, x, y, size) {
  const lamp = swimmer().beam;
  const k = sideways(d), c = Math.cos(d.pitch), s = Math.sin(d.pitch);
  const px = (0.06 + lamp.x) * size, py = (0.3 + lamp.y) * size;
  const lx = x + k * (px * c - py * s), ly = y + px * s + py * c;
  const angle = Math.atan2(Math.sin(lamp.dip + d.pitch), Math.sign(k) * Math.cos(lamp.dip + d.pitch));
  const len = size * lamp.length;
  const pts = beamPolygon(lx, ly, angle, len, wallsPx, { rays: 24, halfAngle: lamp.spread });
  drawInWater({ x: lx - len, y: ly - len, w: len * 2, h: len * 2 }, g => {
    const glow = g.createLinearGradient(lx, ly, lx + Math.cos(angle) * len, ly + Math.sin(angle) * len);
    glow.addColorStop(0, `rgba(255, 243, 190, ${lamp.alpha})`);
    glow.addColorStop(1, 'rgba(255, 243, 190, 0)');
    g.fillStyle = glow;
    g.beginPath();
    pts.forEach(([bx, by], i) => g[i ? 'lineTo' : 'moveTo'](bx, by));
    g.closePath();
    g.fill();
  }, 'lighter');
}

// Paints `paint(g)` (in screen px) into a scratch layer the size of `box`, cuts away whatever lies
// over a wall or the ice with the wall mask, and puts the rest on screen with `op`: so a beam,
// bubbles, silt or smoke show in the open water only.
function drawInWater(box, paint, op = 'source-over') {
  if (!box) return;
  const dpr = devicePixelRatio || 1;
  const pw = Math.ceil(box.w * dpr), ph = Math.ceil(box.h * dpr);
  if (!(pw > 0 && ph > 0)) return;
  if (waterLayer.width < pw || waterLayer.height < ph) {
    waterLayer.width = Math.max(waterLayer.width, pw);
    waterLayer.height = Math.max(waterLayer.height, ph);
  }
  const g = waterLayer.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, pw, ph);
  g.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
  paint(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(wallMask, box.x * dpr, box.y * dpr, pw, ph, 0, 0, pw, ph);
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.drawImage(waterLayer, 0, 0, pw, ph, box.x, box.y, box.w, box.h);
  ctx.restore();
}


// Pause menu over the frozen game: large buttons, the selected one lit up yellow.
export function renderPause(now, { items, selected }) {
  const w = innerWidth, h = innerHeight;
  ctx.fillStyle = 'rgba(7, 10, 31, 0.75)';
  ctx.fillRect(0, 0, w, h);
  drawText('Пауза', w / 2, h * 0.18, h * 0.09, 'center', '#ffd60a');

  const bw = Math.min(w * 0.55, h * 0.95), bh = h * 0.12, gap = h * 0.045;
  const top = h * 0.55 - (items.length * bh + (items.length - 1) * gap) / 2;
  items.forEach((label, i) => {
    const y = top + i * (bh + gap);
    const lit = i === selected;
    ctx.save();
    if (lit) {
      ctx.shadowColor = '#ffd60a';
      ctx.shadowBlur = h * (0.02 + 0.015 * Math.sin(now / 300));
    }
    ctx.beginPath();
    ctx.roundRect(w / 2 - bw / 2, y, bw, bh, bh / 2);
    ctx.fillStyle = lit ? '#ffd60a' : '#1a2255';
    ctx.fill();
    if (!lit) {
      ctx.lineWidth = h * 0.006;
      ctx.strokeStyle = '#7f8fd1';
      ctx.stroke();
    }
    ctx.restore();
    ctx.font = `${h * 0.05}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lit ? '#070a1f' : '#ffffff';
    ctx.fillText(label, w / 2, y + bh / 2);
  });
}

// After the last level: the three rovers on show in a museum, and a button to play again.
export function renderFinale(now) {
  const w = innerWidth, h = innerHeight;
  drawMuseum(ctx, now, w, h);
  drawText('Все машины', w / 2, h * 0.085, h * 0.058, 'center', '#ffd60a');
  drawText('выполнили свои миссии!', w / 2, h * 0.165, h * 0.058, 'center', '#ffd60a');

  const bw = Math.min(w * 0.4, h * 0.75), bh = h * 0.09, by = h * 0.93;
  ctx.beginPath();
  ctx.ellipse(w / 2, by + bh * 0.55, bw * 0.45, bh * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = h * (0.02 + 0.015 * Math.sin(now / 300));
  ctx.beginPath();
  ctx.roundRect(w / 2 - bw / 2, by - bh / 2, bw, bh, bh / 2);
  ctx.fillStyle = '#ffd60a';
  ctx.fill();
  ctx.restore();
  ctx.font = `${h * 0.05}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#070a1f';
  ctx.fillText('Начать сначала', w / 2, by);
}

// Start screen: the rover of the level about to be played drives round its planet.
export function renderTitle(now, { planet, levelNumber, dark = false }) {
  const w = innerWidth, h = innerHeight;
  const p = PLANETS[planet];
  drawSky(now, w, h, planet);

  const radius = Math.min(w, h) * 0.18;
  drawTitleScene(ctx, now, { cx: w / 2, cy: h * 0.66, radius, size: radius * 0.7, planet, p, night: dark });

  drawText('Космический лабиринт', w / 2, h * 0.15, h * 0.09, 'center', '#ffd60a');
  drawText(`${p.name} — уровень ${levelNumber}`, w / 2, h * 0.26, h * 0.045, 'center', '#ffffff');
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 300);
  drawText('Нажми Enter', w / 2, h * 0.9, h * 0.06, 'center', '#ffffff');
  ctx.globalAlpha = 1;
}

// Shown instead of the game so a broken hand-edited level is obvious rather than a frozen screen.
export function drawError(message) {
  const w = innerWidth, h = innerHeight;
  ctx.fillStyle = '#070a1f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = `bold ${Math.round(h * 0.035)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Ошибка:', w * 0.05, h * 0.1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(message, w * 0.05, h * 0.17);
}

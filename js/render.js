// Everything drawn on the canvas: layout, cached maze and track layers, the frame itself.

import { state, roverPos } from './game.js';
import { PLANETS, PLANET_KEYS } from './planets.js';
import { BUMP_MS, DIRS, ROVER_RATIO, WALL_RATIO, WIN } from './config.js';
import { mulberry32 } from './random.js';
import { createWeather, weatherIntensity } from './weather.js';
import { createNight } from './night.js';
import { createStorm } from './storm.js';
import { ROVERS, drawPad, drawRocket, drawSoundOff, drawText, useContext } from './art.js';
import { LANDMARKS } from './landmarks.js';
import { drawMeteor, meteorShake } from './meteor.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
useContext(ctx);
// The maze and the tracks only change on level start or resize (tracks grow), so they are
// drawn once into offscreen layers instead of every frame.
const mazeLayer = document.createElement('canvas');
const trackLayer = document.createElement('canvas');
const veilLayer = document.createElement('canvas');
let drawnTracks = 0;
let decor = null;
let drawWeather = null;
let drawVeil = null;
let wallsPx = [];
let stars = [];

// On a dark level the tracks are pale, so they can glow through the night.
const NIGHT_TRACK = '#9fcbe8';
const STORM_WEATHER = 1.7;

const clamp01 = v => Math.max(0, Math.min(1, v));

function scatter(rand, count, cols, rows, minR, maxR) {
  return Array.from({ length: Math.round(count) }, () => ({
    x: rand() * cols,
    y: rand() * rows,
    r: minR + rand() * (maxR - minR),
  }));
}

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

// Seeded by level, so a level's decorations look the same every time — part of what makes it recognisable.
function makeDecor() {
  const { cols, rows } = state.maze;
  const rand = mulberry32(state.index + 1);
  return {
    craters: scatter(rand, cols * rows * 0.5, cols, rows, 0.05, 0.15),
    specks: scatter(rand, cols * rows * 6, cols, rows, 0.01, 0.035),
    walls: wallSegments(state.maze),
  };
}

export function levelChanged(levelCount) {
  decor = makeDecor();
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

// A meteor crater appeared: redraw the cached layer. The walls the crater adds to the maze are
// not drawn; the crater itself has to look impassable.
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
  const cell = Math.min((w - 2 * margin) / cols, (h - header - margin) / rows);
  const ox = (w - cell * cols) / 2;
  const oy = header + (h - header - margin - cell * rows) / 2;
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

  g.save();
  g.beginPath();
  g.roundRect(ox - wall / 2, oy - wall / 2, cell * cols + wall, cell * rows + wall, wall);
  g.fillStyle = p.floor;
  g.fill();
  g.clip();
  g.fillStyle = p.speck;
  for (const s of decor.specks) {
    g.beginPath();
    g.arc(ox + s.x * cell, oy + s.y * cell, s.r * cell, 0, Math.PI * 2);
    g.fill();
  }
  for (const c of decor.craters) {
    const x = ox + c.x * cell, y = oy + c.y * cell, r = c.r * cell;
    g.fillStyle = p.crater;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.craterRim;
    g.lineWidth = r * 0.25;
    g.beginPath();
    g.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9);
    g.stroke();
  }
  for (const l of state.landmarks.filter(l => !LANDMARKS[l.type].upright)) {
    LANDMARKS[l.type].draw(g, ox + (l.x + 0.5) * cell, oy + (l.y + 0.5) * cell, cell * (LANDMARKS[l.type].size ?? 0.4), p);
  }
  g.restore();

  const ragged = (halfWidth, amp, dx = 0, dy = 0) =>
    decor.walls.map(seg => raggedWall(seg, halfWidth, amp, state.index).map(([x, y]) => [ox + (x + dx) * cell, oy + (y + dy) * cell]));
  const half = WALL_RATIO / 2;
  wallsPx = decor.walls.map(([x0, y0, x1, y1]) => [ox + x0 * cell, oy + y0 * cell, ox + x1 * cell, oy + y1 * cell]);
  fillShapes(g, ragged(half, 0.03, 0.02, 0.04), 'rgba(0, 0, 0, 0.35)');
  fillShapes(g, ragged(half, 0.03), p.wallBase);
  fillShapes(g, ragged(half * 0.45, 0.015, -0.008, -0.016), p.wallTop);
}

// Cheap deterministic noise in [-1, 1] for a grid-unit point; shared by touching walls,
// so ragged edges line up where segments meet.
function wallNoise(x, y, salt) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

// Outline of one wall segment with a ragged edge on both sides and roughly round ends.
function raggedWall([x0, y0, x1, y1], halfWidth, amp, salt) {
  const STEPS = 6;
  const nx = y0 - y1, ny = x1 - x0;
  const side = sign => Array.from({ length: STEPS + 1 }, (_, k) => {
    const t = k / STEPS, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const w = halfWidth + amp * wallNoise(x * STEPS, y * STEPS, salt + sign);
    return [x + nx * w * sign, y + ny * w * sign];
  });
  const cap = (cx, cy, from) => Array.from({ length: 5 }, (_, k) => {
    const a = from - (k + 1) * Math.PI / 6;
    const w = halfWidth + amp * wallNoise(cx * 7 + k, cy * 7, salt);
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

function drawTrack(g, { a, b }, cell, ox, oy) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const along = cell * 0.07, across = cell * 0.13;
  const [w, h] = dx ? [along, across] : [across, along];
  for (let t = 0; t < 1; t += 0.2) {
    for (const side of [-0.3, 0.3]) {
      const x = ox + (a.x + 0.5 + dx * t - dy * side) * cell;
      const y = oy + (a.y + 0.5 + dy * t + dx * side) * cell;
      g.fillRect(x - w / 2, y - h / 2, w, h);
    }
  }
}

function buildTrackLayer() {
  trackLayer.width = canvas.width;
  trackLayer.height = canvas.height;
  drawnTracks = 0;
  drawNewTracks();
}

function drawNewTracks() {
  const g = trackLayer.getContext('2d');
  const dpr = devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = state.dark ? NIGHT_TRACK : PLANETS[state.planet].track;
  const { cell, ox, oy } = layout();
  for (; drawnTracks < state.tracks.length; drawnTracks++) drawTrack(g, state.tracks[drawnTracks], cell, ox, oy);
}

function makeStars() {
  stars = Array.from({ length: Math.round(innerWidth * innerHeight / 3000) }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 0.3 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawSky(now, w, h) {
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
}

export function render(now, { soundOff = false } = {}) {
  const planet = PLANETS[state.planet];
  const { w, h, header, cell, ox, oy } = layout();
  const toPx = p => [ox + (p.x + 0.5) * cell, oy + (p.y + 0.5) * cell];
  const winT = state.wonAt === null ? null : now - state.wonAt;

  drawSky(now, w, h);
  const [shakeX, shakeY] = meteorShake(state.meteor, now, cell);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.drawImage(mazeLayer, 0, 0, w, h);
  drawNewTracks();
  ctx.drawImage(trackLayer, 0, 0, w, h);

  for (const l of state.landmarks.filter(l => LANDMARKS[l.type].upright)) {
    const [lx, ly] = toPx(l);
    LANDMARKS[l.type].draw(lx, ly + cell * 0.3, cell * 0.75, now);
  }

  const [gx, gy] = toPx(state.goal);
  const padY = gy + cell * 0.32;
  drawPad(gx, padY, cell, now);

  const flame = winT !== null && winT >= WIN.ignite;
  const shake = flame && winT < WIN.lift ? (Math.random() - 0.5) * cell * 0.04 : 0;
  const liftT = winT === null ? 0 : clamp01((winT - WIN.lift) / WIN.liftMs);
  const lift = liftT * liftT * (padY + cell * 2);
  drawRocket(gx + shake, padY - lift, cell * 0.95, flame, now);

  const shrink = winT === null ? 1 : 1 - clamp01((winT - WIN.shrinkStart) / WIN.shrinkMs);
  let rover = null;
  if (shrink > 0) {
    const [rx, ry] = toPx(roverPos(now));
    const bumpT = state.bump ? (now - state.bump.at) / BUMP_MS : 1;
    const nudge = bumpT < 1 ? Math.sin(Math.PI * bumpT) * cell * 0.1 : 0;
    const { dx, dy } = state.bump ? DIRS[state.bump.dir] : DIRS.right;
    rover = { x: rx + dx * nudge, y: ry + dy * nudge, angle: state.angle, size: cell * ROVER_RATIO * shrink };
    rover.draw = () => ROVERS[planet.rover](rover.x, rover.y, rover.angle, rover.size);
    rover.draw();
  }

  drawMeteor(ctx, state.meteor, now, cell, toPx);
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
    drawWeather(ctx, now, { w, h }, area);
  }
  if (winT !== null && winT >= WIN.lift) drawText('Ура!', w / 2, h / 2, h * 0.18, 'center', '#ffd60a');
  if (soundOff) drawSoundOff(w - header * 0.7, header / 2, header * 0.5);
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
    ctx.font = `bold ${h * 0.05}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lit ? '#070a1f' : '#ffffff';
    ctx.fillText(label, w / 2, y + bh / 2);
  });
}

// After the last level: all three rovers in a row, bobbing happily, and a button to play again.
export function renderFinale(now) {
  const w = innerWidth, h = innerHeight;
  drawSky(now, w, h);
  drawText('Все роверы', w / 2, h * 0.16, h * 0.08, 'center', '#ffd60a');
  drawText('выполнили свои миссии!', w / 2, h * 0.27, h * 0.08, 'center', '#ffd60a');

  const size = Math.min(w * 0.18, h * 0.22);
  PLANET_KEYS.forEach((planet, i) => {
    const phase = now / 350 + i * 2;
    const x = w / 2 + (i - 1) * size * 1.4;
    const y = h * 0.53 + Math.sin(phase) * size * 0.06;
    ROVERS[PLANETS[planet].rover](x, y, -Math.PI / 2 + Math.sin(phase * 0.7) * 0.15, size);
  });

  const bw = Math.min(w * 0.4, h * 0.75), bh = h * 0.11, by = h * 0.8;
  ctx.save();
  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = h * (0.02 + 0.015 * Math.sin(now / 300));
  ctx.beginPath();
  ctx.roundRect(w / 2 - bw / 2, by - bh / 2, bw, bh, bh / 2);
  ctx.fillStyle = '#ffd60a';
  ctx.fill();
  ctx.restore();
  ctx.font = `bold ${h * 0.05}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#070a1f';
  ctx.fillText('Начать сначала', w / 2, by);
}

// Start screen: the rover of the level about to be played circles on a patch of its planet.
export function renderTitle(now, { planet, levelNumber }) {
  const w = innerWidth, h = innerHeight;
  const p = PLANETS[planet];
  drawSky(now, w, h);

  const cx = w / 2, cy = h * 0.57, r = Math.min(w, h) * 0.17;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
  ctx.fillStyle = p.floor;
  ctx.fill();
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = p.wallBase;
  ctx.stroke();
  const a = now / 1600;
  ROVERS[p.rover](cx + Math.cos(a) * r, cy + Math.sin(a) * r, a + Math.PI / 2, Math.min(w, h) * 0.13);

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

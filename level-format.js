// Level text format, shared by the game, tools/gen-levels.mjs and the tests.
// Cells sit at odd rows/columns; the characters between them are walls.

import { LANDMARK_BY_CHAR } from './js/landmarks.js';

// M and T belong to a meteor event: it lands on M once the rover drives onto T, or soon after the
// level starts when there is no T (see js/game.js).
const LEVEL_CELL_CHARS = { ' ': null, S: 'start', R: 'rocket', M: 'impact', T: 'trigger', ...LANDMARK_BY_CHAR };
// The rover must be at least this many steps from the impact when the meteor is set off.
export const METEOR_MIN_DISTANCE = 3;
const LEVEL_WALL_CHARS = ['#', ' '];
// Narrower and the storm's two billowing fronts would cross (see STORM.edge in js/storm.js).
export const STORM_MIN_CELLS = 3;
export const LEVEL_DIRS = [
  { dx: 0, dy: -1, wall: 'top' },
  { dx: 0, dy: 1, wall: 'bottom' },
  { dx: -1, dy: 0, wall: 'left' },
  { dx: 1, dy: 0, wall: 'right' },
];

// Tolerates what hand editing tends to leave: CRLF, trailing spaces, a common indent,
// blank lines around the map.
export function normalizeLevelLines(map) {
  const lines = map.split(/\r?\n/).map(l => l.trimEnd());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const indent = Math.min(...lines.filter(Boolean).map(l => l.match(/^\s*/)[0].length));
  return lines.map(l => l.slice(indent));
}

export function parseLevel(level, number, planets) {
  const fail = msg => { throw new Error(`Уровень ${number}: ${msg}`); };
  const at = (row, col) => `строка ${row + 1}, символ ${col + 1}`;

  if (!level || typeof level !== 'object') fail('пустой уровень — может, осталась лишняя запятая после удаления?');
  const { planet, map, dark = false, storm = null } = level;

  if (!planets.includes(planet)) fail(`неизвестная планета "${planet}", нужна одна из: ${planets.join(', ')}`);
  if (typeof map !== 'string') fail('нет карты');
  if (typeof dark !== 'boolean') fail('dark может быть только true или false');
  if (storm !== null) {
    const ok = storm && typeof storm === 'object' && [storm.from, storm.to].every(v => typeof v === 'number' && v >= 0 && v <= 1) && storm.from < storm.to;
    if (!ok) fail('storm должен быть { from, to } — доли ширины карты от 0 до 1, from < to');
  }
  const lines = normalizeLevelLines(map);
  if (lines.length < 3) fail('карта пустая');
  const width = lines[0].length;
  lines.forEach((l, row) => {
    if (l.length !== width) fail(`строка ${row + 1} длиной ${l.length}, а первая — ${width}`);
  });
  if (width % 2 === 0 || lines.length % 2 === 0) {
    fail(`размер карты ${width}×${lines.length}, а должен быть нечётным по обеим сторонам`);
  }

  const lastRow = lines.length - 1, lastCol = width - 1;
  lines.forEach((l, row) => [...l].forEach((ch, col) => {
    const onFrame = row === 0 || col === 0 || row === lastRow || col === lastCol;
    const isCell = row % 2 === 1 && col % 2 === 1;
    if (onFrame && ch !== '#') fail(`${at(row, col)}: дыра во внешней стене`);
    if (isCell && !(ch in LEVEL_CELL_CHARS)) {
      fail(`${at(row, col)}: непонятный символ "${ch}" (можно: пробел, S, R, M, T, ${Object.keys(LANDMARK_BY_CHAR).join(', ')} — латиницей)`);
    }
    if (!isCell && !LEVEL_WALL_CHARS.includes(ch)) {
      fail(`${at(row, col)}: "${ch}" стоит на месте стены, тут можно только # или пробел`);
    }
  }));

  const cols = (width - 1) / 2, rows = (lines.length - 1) / 2;
  const cells = [];
  const landmarks = [];
  const starts = [], rockets = [], impacts = [], triggers = [];
  for (let y = 0; y < rows; y++) {
    cells.push([]);
    for (let x = 0; x < cols; x++) {
      const row = y * 2 + 1, col = x * 2 + 1;
      cells[y].push({
        top: lines[row - 1][col] === '#', bottom: lines[row + 1][col] === '#',
        left: lines[row][col - 1] === '#', right: lines[row][col + 1] === '#',
      });
      const kind = LEVEL_CELL_CHARS[lines[row][col]];
      if (kind === 'start') starts.push({ x, y });
      else if (kind === 'rocket') rockets.push({ x, y });
      else if (kind === 'impact') impacts.push({ x, y });
      else if (kind === 'trigger') triggers.push({ x, y });
      else if (kind) landmarks.push({ type: kind, x, y });
    }
  }
  if (starts.length !== 1) fail(`стартов S: ${starts.length}, а нужен ровно один`);
  if (rockets.length !== 1) fail(`ракет R: ${rockets.length}, а нужна ровно одна`);

  const maze = { cols, rows, cells };
  const [start] = starts, [goal] = rockets;
  const toGoal = levelDistances(maze, start).get(`${goal.x},${goal.y}`);
  if (!toGoal) fail('до ракеты не доехать');
  let meteor = null;
  if (impacts.length || triggers.length) {
    if (impacts.length !== 1 || triggers.length > 1) fail(`метеорит: нужна ровно одна M и не больше одной T, а тут M: ${impacts.length}, T: ${triggers.length}`);
    const [cell] = impacts, trigger = triggers[0] ?? null;
    const setOff = trigger ?? start;
    const fromTrigger = levelDistances(maze, setOff).get(`${cell.x},${cell.y}`);
    if (!fromTrigger || fromTrigger.dist < METEOR_MIN_DISTANCE) fail(`метеорит M должен быть не ближе ${METEOR_MIN_DISTANCE} клеток пути от ${trigger ? 'T' : 'старта'}`);
    const blocked = blockCell(maze, cell);
    for (const [name, from] of [['старта', start], ['T', trigger]]) {
      if (from && !levelDistances(blocked, from).has(`${goal.x},${goal.y}`)) fail(`после падения метеорита до ракеты не доехать от ${name}`);
    }
    meteor = { cell, trigger };
  }
  // The storm snaps to cell columns, so what is drawn and what counts as inside agree.
  const stormCells = storm && { from: Math.round(storm.from * cols), to: Math.round(storm.to * cols) };
  if (storm && stormCells.to - stormCells.from < STORM_MIN_CELLS) fail(`буря уже ${STORM_MIN_CELLS} клеток, её края будут налезать друг на друга`);
  return { planet, dark, storm: stormCells, meteor, maze, start, goal, landmarks, startDir: toGoal.first };
}

// Breadth-first search: "x,y" → { dist, first } for every cell reachable from `from`,
// where `first` is the wall name of the first step on a shortest path to that cell.
export function levelDistances(maze, from) {
  const seen = new Map([[`${from.x},${from.y}`, { dist: 0, first: null }]]);
  const queue = [from];
  while (queue.length) {
    const { x, y } = queue.shift();
    const here = seen.get(`${x},${y}`);
    for (const d of LEVEL_DIRS) {
      const key = `${x + d.dx},${y + d.dy}`;
      if (maze.cells[y][x][d.wall] || seen.has(key)) continue;
      seen.set(key, { dist: here.dist + 1, first: here.first ?? d.wall });
      queue.push({ x: x + d.dx, y: y + d.dy });
    }
  }
  return seen;
}

const OPPOSITE_WALL = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

// A copy of the maze with `cell` walled off on all sides, as a meteor crater leaves it.
export function blockCell(maze, { x, y }) {
  const cells = maze.cells.map(row => row.map(c => ({ ...c })));
  for (const d of LEVEL_DIRS) {
    cells[y][x][d.wall] = true;
    const nx = x + d.dx, ny = y + d.dy;
    if (ny >= 0 && ny < maze.rows && nx >= 0 && nx < maze.cols) cells[ny][nx][OPPOSITE_WALL[d.wall]] = true;
  }
  return { ...maze, cells };
}

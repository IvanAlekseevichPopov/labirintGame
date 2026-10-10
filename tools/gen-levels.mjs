// Generates levels.js. Each level is the best of CANDIDATES random mazes, scored against a
// difficulty curve. levels.js is curated by hand afterwards, so:
//   node tools/gen-levels.mjs --force       regenerate the whole set (overwrites hand edits)
//   node tools/gen-levels.mjs --only 4,26   regenerate just these levels, keep the rest as is
// To get a different maze for a level, bump its entry in VARIANTS and run --only for it.

import fs from 'node:fs';
import vm from 'node:vm';

const SEED = 20261010;
const LEVEL_COUNT = 40;
const LEVELS_PER_PLANET = 3;
const PLANETS = ['moon', 'mars', 'europa'];
const LANDMARKS = ['F', 'A', 'C'];
const CANDIDATES = 300;
const BRAID_RATIO = 0.3;
// Chance the maze carver keeps going straight: longer corridors, fewer turns per step.
const INERTIA = 0.55;
const MAX_ROWS = 11;
const MAX_COLS = 20;
// level → variant number; changes that level's seed while keeping generation reproducible.
const VARIANTS = { 26: 1 };

const OUT = new URL('../levels.js', import.meta.url);
const { parseLevel, levelDistances, normalizeLevelLines, LEVEL_DIRS } = vm.runInContext(
  `${fs.readFileSync(new URL('../level-format.js', import.meta.url), 'utf8')}
  ({ parseLevel, levelDistances, normalizeLevelLines, LEVEL_DIRS })`,
  vm.createContext({}),
);
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-level seed: tweaking one level does not reshuffle all the following ones.
let rand;
const pick = arr => arr[Math.floor(rand() * arr.length)];
const shuffle = arr => arr.map(v => [rand(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const key = ({ x, y }) => `${x},${y}`;
const unkey = k => { const [x, y] = k.split(',').map(Number); return { x, y }; };
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Difficulty curve, t = 0 on the first level and 1 on the last.
const curve = level => (level - 1) / (LEVEL_COUNT - 1);
const targetPath = level => Math.round(8 + 62 * curve(level));
// Biggest dead-end region hanging off the route: tiny at first, large on the last levels.
const maxTrap = level => Math.round(2 + 58 * curve(level) ** 1.5);
// Moves a kid heading towards the rocket needs, relative to the shortest route.
const targetNaiveRatio = level => 1 + curve(level);
const maxNaiveRatio = level => 1.1 + 1.9 * curve(level);
// The rocket should not look close while the route to it is long.
const MAX_DETOUR = 3;

function levelSize(level) {
  // Only the first three levels are the smallest size; then it grows every five levels.
  const rows = level <= 3 ? 4 : Math.min(4 + Math.max(1, Math.floor((level - 1) / 5)), MAX_ROWS);
  const cols = Math.min(Math.round(rows * 16 / 9), MAX_COLS);
  return { cols, rows };
}

function generateMaze(cols, rows) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ top: true, right: true, bottom: true, left: true })));
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const open = (x, y, d) => {
    cells[y][x][d.wall] = false;
    cells[y + d.dy][x + d.dx][OPPOSITE[d.wall]] = false;
  };

  const first = { x: Math.floor(rand() * cols), y: Math.floor(rand() * rows), dir: null };
  const visited = new Set([key(first)]);
  const stack = [first];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = LEVEL_DIRS.filter(d =>
      inBounds(cur.x + d.dx, cur.y + d.dy) && !visited.has(key({ x: cur.x + d.dx, y: cur.y + d.dy })));
    if (!options.length) { stack.pop(); continue; }
    const straight = options.find(d => d === cur.dir);
    const d = straight && rand() < INERTIA ? straight : pick(options);
    open(cur.x, cur.y, d);
    const next = { x: cur.x + d.dx, y: cur.y + d.dy, dir: d };
    visited.add(key(next));
    stack.push(next);
  }

  // A perfect maze has long dead ends; opening some into loops means less backtracking.
  const exits = (x, y) => LEVEL_DIRS.filter(d => !cells[y][x][d.wall]).length;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (exits(x, y) !== 1 || rand() > BRAID_RATIO) continue;
      const closed = LEVEL_DIRS.filter(d => cells[y][x][d.wall] && inBounds(x + d.dx, y + d.dy));
      const deadEnds = closed.filter(d => exits(x + d.dx, y + d.dy) === 1);
      open(x, y, pick(deadEnds.length ? deadEnds : closed));
    }
  }
  return { cols, rows, cells };
}

const neighbours = (maze, { x, y }) => LEVEL_DIRS
  .filter(d => !maze.cells[y][x][d.wall])
  .map(d => ({ x: x + d.dx, y: y + d.dy }));

// Steps taken by a player who always tries the turn that heads most directly at the rocket
// and backs out of dead ends: a rough model of how a 6-year-old plays.
function naiveSteps(maze, start, goal) {
  const seen = new Set([key(start)]);
  let steps = 0;
  const walk = cell => {
    if (cell.x === goal.x && cell.y === goal.y) return true;
    const next = neighbours(maze, cell)
      .filter(n => !seen.has(key(n)))
      .sort((a, b) => manhattan(a, goal) - manhattan(b, goal));
    for (const n of next) {
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      steps++;
      if (walk(n)) return true;
      steps++;
    }
    return false;
  };
  walk(start);
  return steps;
}

// Size of the largest region of off-route cells that touches the route at a single cell,
// i.e. a dead end you have to drive all the way back out of. A region hanging only off the
// rocket does not count: reaching the rocket ends the level.
function biggestTrap(maze, onRoute, goal) {
  const seen = new Set();
  let biggest = 0;
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      if (onRoute.has(key({ x, y })) || seen.has(key({ x, y }))) continue;
      const queue = [{ x, y }];
      const attachments = new Set();
      let size = 0;
      seen.add(key({ x, y }));
      while (queue.length) {
        const cell = queue.shift();
        size++;
        for (const n of neighbours(maze, cell)) {
          if (onRoute.has(key(n))) attachments.add(key(n));
          else if (!seen.has(key(n))) { seen.add(key(n)); queue.push(n); }
        }
      }
      if (attachments.size === 1 && !attachments.has(key(goal))) biggest = Math.max(biggest, size);
    }
  }
  return biggest;
}

const START_SPOTS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top', 'bottom', 'center'];

function spotCell(spot, cols, rows) {
  const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
  return {
    'top-left': { x: 0, y: 0 },
    'top-right': { x: cols - 1, y: 0 },
    'bottom-left': { x: 0, y: rows - 1 },
    'bottom-right': { x: cols - 1, y: rows - 1 },
    left: { x: 0, y: my },
    right: { x: cols - 1, y: my },
    top: { x: mx, y: 0 },
    bottom: { x: mx, y: rows - 1 },
    center: { x: mx, y: my },
  }[spot];
}

function candidate(level, spot) {
  const { cols, rows } = levelSize(level);
  const maze = generateMaze(cols, rows);
  const start = spotCell(spot, cols, rows);
  const fromStart = levelDistances(maze, start);

  const target = targetPath(level);
  const rocketKey = [...fromStart.keys()]
    .filter(k => k !== key(start))
    .sort((a, b) => Math.abs(fromStart.get(a).dist - target) - Math.abs(fromStart.get(b).dist - target))
    .slice(0, 5)[Math.floor(rand() * 5)] ?? [...fromStart.keys()].pop();
  const goal = unkey(rocketKey);
  const path = fromStart.get(rocketKey).dist;

  const fromGoal = levelDistances(maze, goal);
  const onRoute = new Set([...fromStart].filter(([k, v]) => v.dist + fromGoal.get(k).dist === path).map(([k]) => k));

  const metrics = {
    path,
    naive: naiveSteps(maze, start, goal),
    trap: biggestTrap(maze, onRoute, goal),
    detour: path / manhattan(start, goal),
  };
  const penalty =
    Math.abs(path - target) / target +
    Math.abs(metrics.naive / path - targetNaiveRatio(level)) / 2 +
    Math.max(0, metrics.naive / path - maxNaiveRatio(level)) * 3 +
    Math.max(0, metrics.trap - maxTrap(level)) / 2 +
    Math.max(0, metrics.detour - MAX_DETOUR) * 3;
  return { spot, maze, start, goal, fromStart, fromGoal, onRoute, metrics, penalty };
}

// Landmarks sit on the route between a quarter and three quarters of the way,
// so they mark the way instead of luring into a dead end.
function placeLandmarks(level, c, prevTypes) {
  const count = level <= 3 ? 1 : 1 + Math.floor(rand() * 2);
  const { path } = c.metrics;
  const types = shuffle(LANDMARKS.filter(t => !prevTypes.includes(t))).concat(shuffle(LANDMARKS))
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, count);
  const marks = new Map([[key(c.start), 'S'], [key(c.goal), 'R']]);
  types.forEach((type, i) => {
    const lo = path * (0.25 + 0.5 * i / count), hi = path * (0.25 + 0.5 * (i + 1) / count);
    const spots = [...c.onRoute].filter(k => {
      const d = c.fromStart.get(k).dist;
      return !marks.has(k) && d >= lo && d <= hi && d >= 3 && c.fromGoal.get(k).dist >= 3;
    });
    if (spots.length) marks.set(pick(spots), type);
  });
  return marks;
}

function toAscii(maze, marks) {
  const { cols, rows, cells } = maze;
  const grid = Array.from({ length: rows * 2 + 1 }, () => Array(cols * 2 + 1).fill('#'));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid[y * 2 + 1][x * 2 + 1] = marks.get(key({ x, y })) ?? ' ';
      if (!cells[y][x].right) grid[y * 2 + 1][x * 2 + 2] = ' ';
      if (!cells[y][x].bottom) grid[y * 2 + 2][x * 2 + 1] = ' ';
    }
  }
  return grid.map(row => row.join('')).join('\n');
}

function makeLevel(level, prev) {
  rand = mulberry32(SEED * 100 + level + (VARIANTS[level] ?? 0) * 7919);
  // The first levels start top-left like most kids expect; later ones vary.
  const spots = level <= 2 ? ['top-left'] : START_SPOTS.filter(s => s !== prev.spot);
  let best = null;
  for (let i = 0; i < CANDIDATES; i++) {
    const c = candidate(level, pick(spots));
    if (!best || c.penalty < best.penalty) best = c;
  }
  const marks = placeLandmarks(level, best, prev.types);
  return {
    spot: best.spot,
    types: [...marks.values()].filter(m => LANDMARKS.includes(m)),
    metrics: best.metrics,
    level: {
      planet: PLANETS[Math.floor((level - 1) / LEVELS_PER_PLANET) % PLANETS.length],
      map: toAscii(best.maze, marks),
    },
  };
}

const args = process.argv.slice(2);
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const only = onlyArg && new Set(onlyArg.split(',').map(Number));

function readExisting() {
  return vm.runInContext(`${fs.readFileSync(OUT, 'utf8')}\nLEVELS`, vm.createContext({}));
}

// What makeLevel needs to know about the level before it, recovered from its map.
function describe(level, number) {
  const { maze, start, landmarks } = parseLevel(level, number, PLANETS);
  return {
    spot: START_SPOTS.find(s => key(spotCell(s, maze.cols, maze.rows)) === key(start)) ?? null,
    types: landmarks.map(l => ({ flag: 'F', antenna: 'A', crater: 'C' })[l.type]),
  };
}

let levels;
const made = new Map();
if (only) {
  if (!fs.existsSync(OUT)) {
    console.error('levels.js нет — сначала полная генерация с --force');
    process.exit(1);
  }
  levels = Array.from(readExisting(), l => ({ planet: l.planet, map: normalizeLevelLines(l.map).join('\n') }));
  for (const number of only) {
    if (!Number.isInteger(number) || number < 1 || number > levels.length) {
      console.error(`--only: нет уровня ${number}, всего ${levels.length}`);
      process.exit(1);
    }
    const prev = number > 1 ? describe(levels[number - 2], number - 1) : { spot: null, types: [] };
    const result = makeLevel(number, prev);
    levels[number - 1] = result.level;
    made.set(number, result);
  }
} else {
  if (fs.existsSync(OUT) && !args.includes('--force')) {
    console.error('levels.js уже есть и мог быть отредактирован руками. Перезаписать всё: --force, один уровень: --only N');
    process.exit(1);
  }
  levels = [];
  let prev = { spot: null, types: [] };
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    prev = makeLevel(level, prev);
    levels.push(prev.level);
    made.set(level, prev);
  }
}
levels.forEach((level, i) => parseLevel(level, i + 1, PLANETS));

const source = `// Generated by tools/gen-levels.mjs (seed ${SEED}). Safe to edit, reorder or delete levels by hand.
// Each cell is at an odd row/column; the characters between cells are walls.
// # wall, S start, R rocket; landmarks: F flag, A antenna, C big crater.
const LEVELS = [
${levels.map((level, i) => `  // ${i + 1}
  { planet: '${level.planet}', map: \`
${level.map}
\` },`).join('\n')}
];
`;
const tmp = new URL('../levels.js.tmp', import.meta.url);
fs.writeFileSync(tmp, source);
fs.renameSync(tmp, OUT);

console.table([...made].map(([number, { level, metrics: m }]) => ({
  level: number,
  planet: level.planet,
  size: `${levelSize(number).cols}x${levelSize(number).rows}`,
  path: m.path,
  target: targetPath(number),
  naive: `${m.naive} (${(m.naive / m.path).toFixed(1)}x, цель ${targetNaiveRatio(number).toFixed(1)})`,
  trap: `${m.trap} ≤ ${maxTrap(number)}`,
  detour: m.detour.toFixed(1),
})));

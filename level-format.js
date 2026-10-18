// Level text format, shared by the game, tools/gen-levels.mjs and the tests.
// Cells sit at odd rows/columns; the characters between them are walls.

import { LANDMARK_BY_CHAR, LANDMARKS } from './js/landmarks.js';
import { PLANETS } from './js/planets.js';

// M and T belong to a meteor event: it lands on M once the rover drives onto T, or soon after the
// level starts when there is no T (see js/game.js). W and B are a white and a black smoker on the
// floor of the cell, for the oceans seen from the side: decoration, the cell stays open.
const LEVEL_CELL_CHARS = { ' ': null, S: 'start', R: 'rocket', M: 'impact', T: 'trigger', W: 'white', B: 'black', ...LANDMARK_BY_CHAR };
// The rover must be at least this many steps from the impact when the meteor is set off.
export const METEOR_MIN_DISTANCE = 3;
// I is a wall of ice the rover can drill through, on planets whose rover has a drill.
const LEVEL_WALL_CHARS = ['#', ' ', 'I'];
const isWall = ch => ch === '#' || ch === 'I';
// Scenes a level can open with (`intro`), which the player only watches. Each checks the map has
// what it needs and returns what the game plays it with.
const INTROS = {
  // The rover drills the ice wall next to the start by itself and drives through: `dir` is its wall.
  drill({ start, goal, ice, fail }) {
    const next = ice.filter(w => [w.a, w.b].some(c => c.x === start.x && c.y === start.y));
    if (next.length !== 1) fail(`показ бура intro: 'drill': у старта должна быть ровно одна ледяная стена I, а их ${next.length}`);
    const [{ a, b }] = next;
    const other = a.x === start.x && a.y === start.y ? b : a;
    if (other.x === goal.x && other.y === goal.y) fail("показ бура intro: 'drill': за ледяной стеной у старта сразу ракета, показ въедет в неё без победы");
    return { dir: LEVEL_DIRS.find(d => start.x + d.dx === other.x && start.y + d.dy === other.y).wall };
  },
};
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
  const { planet, map, look, dark = false, storm = null, intro = null, wreck = null, dusk = false, jellies = null, schools = null } = level;

  if (!planets.includes(planet)) fail(`неизвестная планета "${planet}", нужна одна из: ${planets.join(', ')}`);
  if (typeof map !== 'string') fail('нет карты');
  // The seed of everything random in how it looks, kept in the level so that putting a level in
  // before it does not change how it looks.
  if (!Number.isInteger(look) || look < 0) fail('look — сид украшений уровня, целое число от 0: у каждого уровня свой, чтобы уровень всегда выглядел одинаково');
  if (typeof dark !== 'boolean') fail('dark может быть только true или false');
  if (typeof dusk !== 'boolean') fail('dusk может быть только true или false');
  if (intro !== null && !Object.hasOwn(INTROS, intro)) fail(`intro может быть только: ${Object.keys(INTROS).map(k => `'${k}'`).join(', ')}`);
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
      fail(`${at(row, col)}: непонятный символ "${ch}" (можно: пробел, S, R, M, T, W, B, ${Object.keys(LANDMARK_BY_CHAR).join(', ')} — латиницей)`);
    }
    if (!isCell && !LEVEL_WALL_CHARS.includes(ch)) {
      fail(`${at(row, col)}: "${ch}" стоит на месте стены, тут можно только #, пробел или I`);
    }
    if (ch === 'I') {
      if (!PLANETS[planet].drill) fail(`${at(row, col)}: ледяная стена I бывает только там, где у ровера есть бур (Европа)`);
      if (row % 2 === 0 && col % 2 === 0) fail(`${at(row, col)}: ледяная стена I стоит на углу, а должна стоять между двумя клетками`);
    }
  }));

  const cols = (width - 1) / 2, rows = (lines.length - 1) / 2;
  const cells = [];
  const landmarks = [];
  const starts = [], rockets = [], impacts = [], triggers = [], smokers = [], ice = [];
  for (let y = 0; y < rows; y++) {
    cells.push([]);
    for (let x = 0; x < cols; x++) {
      const row = y * 2 + 1, col = x * 2 + 1;
      cells[y].push({
        top: isWall(lines[row - 1][col]), bottom: isWall(lines[row + 1][col]),
        left: isWall(lines[row][col - 1]), right: isWall(lines[row][col + 1]),
      });
      if (lines[row][col + 1] === 'I') ice.push({ a: { x, y }, b: { x: x + 1, y } });
      if (lines[row + 1][col] === 'I') ice.push({ a: { x, y }, b: { x, y: y + 1 } });
      const kind = LEVEL_CELL_CHARS[lines[row][col]];
      if (kind === 'start') starts.push({ x, y });
      else if (kind === 'rocket') rockets.push({ x, y });
      else if (kind === 'impact') impacts.push({ x, y });
      else if (kind === 'trigger') triggers.push({ x, y });
      else if (kind === 'white' || kind === 'black') {
        if (lines[row + 1][col] !== '#') fail(`${at(row, col)}: курильщик ${lines[row][col]} стоит на дне, а под ним нет стены`);
        smokers.push({ x, y, white: kind === 'white' });
      }
      else if (kind) {
        if (LANDMARKS[kind].side && lines[row + 1][col] !== '#') fail(`${at(row, col)}: ${lines[row][col]} стоит на дне, а под ним нет стены`);
        landmarks.push({ type: kind, x, y });
      }
    }
  }
  if (starts.length !== 1) fail(`стартов S: ${starts.length}, а нужен ровно один`);
  if (rockets.length !== 1) fail(`ракет R: ${rockets.length}, а нужна ровно одна`);
  // Seen from the side (an ocean under ice) the rocket stands on the ice and lets its probe down
  // through the top row; what is drawn from above has no side view yet.
  if (PLANETS[planet].side) {
    if (rockets[0].y !== 0) fail('под водой ракета R стоит на льду: её место в верхнем ряду');
    // The bell's light shines down through the cell below; a floor there would let it through a wall.
    if (cells[0][rockets[0].x].bottom) fail(`${at(1, rockets[0].x * 2 + 1)}: под колоколом ракеты R пол, а нужен проход вниз`);
    // The drone is longer than a cell: at the edge its tail sticks out of the crust, and next to
    // the rocket it would be under it and over the bell's shaft.
    if (wreck !== null) {
      if (!(Number.isInteger(wreck) && wreck >= 1 && wreck <= cols - 2)) fail(`wreck — номер столбца клеток от 1 до ${cols - 2}, над которым во льду вмёрз дрон`);
      if (Math.abs(wreck - rockets[0].x) < 2) fail(`wreck: дрон во льду над столбцом ${wreck} задевает ракету, она над столбцом ${rockets[0].x}; нужно хотя бы через одну клетку`);
    }
    if (jellies !== null) {
      const ok = Array.isArray(jellies) && jellies.length && jellies.every(c => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[0] < cols && c[1] >= 0 && c[1] < rows);
      if (!ok) fail(`jellies — непустой список клеток медуз [x, y], x от 0 до ${cols - 1}, y от 0 до ${rows - 1}`);
      // A jellyfish would cover what sits in the cell, or hang in the smoke over a smoker.
      const taken = [
        [starts[0], 'старт S'], [rockets[0], 'колокол ракеты R'],
        ...landmarks.map(l => [l, `ориентир ${LANDMARKS[l.type].char}`]),
        ...smokers.flatMap(m => [[m, `курильщик ${m.white ? 'W' : 'B'}`], [{ x: m.x, y: m.y - 1 }, `дым курильщика ${m.white ? 'W' : 'B'}`]]),
      ];
      jellies.forEach(([x, y], i) => {
        const hit = taken.find(([c]) => c.x === x && c.y === y);
        if (hit) fail(`jellies: медуза [${x}, ${y}] стоит на клетке, где ${hit[1]}`);
        if (jellies.findIndex(([x2, y2]) => x2 === x && y2 === y) !== i) fail(`jellies: клетка [${x}, ${y}] указана дважды`);
      });
    }
    // A school swims to and fro along a row of cells open to each other.
    if (schools !== null) {
      const ok = Array.isArray(schools) && schools.length && schools.every(s => s && [s.y, s.from, s.to].every(Number.isInteger) && s.y >= 0 && s.y < rows && s.from >= 0 && s.to < cols && s.to - s.from >= 2);
      if (!ok) fail(`schools — непустой список стаек рыб { y, from, to }: ряд y от 0 до ${rows - 1}, клетки from..to от 0 до ${cols - 1}, не короче трёх`);
      for (const { y, from, to } of schools) {
        for (let x = from; x < to; x++) if (cells[y][x].right) fail(`schools: стайке в ряду ${y} от ${from} до ${to} мешает стена между клетками ${x} и ${x + 1}`);
      }
    }
    if (dark || storm) fail('под водой ночи и бури нет: их рисунок сделан для вида сверху');
    if (impacts.length || triggers.length) fail('под водой метеорита нет: его рисунок сделан для вида сверху');
    const above = landmarks.filter(l => !LANDMARKS[l.type].side).map(l => LANDMARKS[l.type].char);
    if (above.length) fail(`под водой ориентира ${above[0]} нет: его рисунок сделан для вида сверху`);
  } else {
    if (smokers.length) fail('курильщики W и B бывают только под водой');
    if (wreck !== null) fail('вмёрзший дрон wreck бывает только под водой');
    if (dusk) fail('сумерки в глубине dusk бывают только под водой');
    if (jellies !== null) fail('медузы jellies бывают только под водой');
    if (schools !== null) fail('стайки рыб schools бывают только под водой');
    const under = landmarks.filter(l => LANDMARKS[l.type].side).map(l => LANDMARKS[l.type].char);
    if (under.length) fail(`ориентир ${under[0]} бывает только под водой`);
  }

  const maze = { cols, rows, cells };
  const [start] = starts, [goal] = rockets;
  // Ice is only in the way until drilled.
  const toGoal = levelDistances(ice.reduce(openWall, maze), start).get(`${goal.x},${goal.y}`);
  if (!toGoal) fail('до ракеты не доехать');
  let meteor = null;
  if (impacts.length || triggers.length) {
    if (impacts.length !== 1 || triggers.length > 1) fail(`метеорит: нужна ровно одна M и не больше одной T, а тут M: ${impacts.length}, T: ${triggers.length}`);
    const [cell] = impacts, trigger = triggers[0] ?? null;
    const setOff = trigger ?? start;
    if (dark || storm) fail('метеорит на ночном уровне или в бурю не поддерживается: его не видно под пеленой, а фары не знают о кратере');
    if (ice.length) fail('метеорит рядом с ледяными стенами не поддерживается: проверка пути не знает, что лёд пробурят');
    const fromTrigger = levelDistances(maze, setOff).get(`${cell.x},${cell.y}`);
    if (!fromTrigger) fail(`до метеорита M не доехать от ${trigger ? 'T' : 'старта'}`);
    if (fromTrigger.dist < METEOR_MIN_DISTANCE) fail(`метеорит M должен быть не ближе ${METEOR_MIN_DISTANCE} клеток пути от ${trigger ? 'T' : 'старта'}`);
    const blocked = blockCell(maze, cell);
    for (const [name, from] of [['старта', start], ['T', trigger]]) {
      if (from && !levelDistances(blocked, from).has(`${goal.x},${goal.y}`)) fail(`после падения метеорита до ракеты не доехать от ${name}`);
    }
    meteor = { cell, trigger };
  }
  if (intro && (dark || storm)) fail('показ intro на ночном уровне или в бурю не поддерживается: он идёт раньше, чем включатся фары');
  const scene = intro && { kind: intro, ...INTROS[intro]({ start, goal, ice, fail }) };
  // The storm snaps to cell columns, so what is drawn and what counts as inside agree.
  const stormCells = storm && { from: Math.round(storm.from * cols), to: Math.round(storm.to * cols) };
  if (storm && stormCells.to - stormCells.from < STORM_MIN_CELLS) fail(`буря уже ${STORM_MIN_CELLS} клеток, её края будут налезать друг на друга`);
  return { planet, look, dark, storm: stormCells, meteor, maze, start, goal, landmarks, smokers, wreck, dusk, jellies: jellies && jellies.map(([x, y]) => ({ x, y })), schools, ice, intro: scene, startDir: scene?.dir ?? toGoal.first };
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

// A copy of the maze with the wall between neighbouring cells `a` and `b` taken out.
export function openWall(maze, { a, b }) {
  const d = LEVEL_DIRS.find(d => a.x + d.dx === b.x && a.y + d.dy === b.y);
  const cells = maze.cells.map(row => row.map(c => ({ ...c })));
  cells[a.y][a.x][d.wall] = false;
  cells[b.y][b.x][OPPOSITE_WALL[d.wall]] = false;
  return { ...maze, cells };
}

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

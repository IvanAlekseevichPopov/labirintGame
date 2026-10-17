import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockCell, parseLevel, levelDistances } from '../level-format.js';
import { PLANET_KEYS } from '../js/planets.js';

const parse = (map, planet = 'moon') => parseLevel({ planet, map }, 7, PLANET_KEYS);
const failsWith = (map, pattern, planet) => assert.throws(() => parse(map, planet), pattern);

const SMALL = `
#######
#S   F#
##### #
#R    #
#######
`;

test('parses walls, start, rocket and landmarks', () => {
  const level = parse(SMALL);
  assert.equal(level.planet, 'moon');
  assert.deepEqual([level.maze.cols, level.maze.rows], [3, 2]);
  assert.deepEqual(level.start, { x: 0, y: 0 });
  assert.deepEqual(level.goal, { x: 0, y: 1 });
  assert.deepEqual(level.landmarks, [{ type: 'flag', x: 2, y: 0 }]);
  assert.deepEqual(level.maze.cells[0][0], { top: true, bottom: true, left: true, right: false });
  assert.deepEqual(level.maze.cells[0][2], { top: true, bottom: false, left: false, right: true });
});

test('startDir points along the shortest path to the rocket', () => {
  assert.equal(parse(SMALL).startDir, 'right');
});

test('tolerates CRLF, common indent, trailing spaces and blank edges', () => {
  const messy = '\r\n\r\n' + SMALL.trim().split('\n').map(l => `      ${l}   `).join('\r\n') + '\r\n   \r\n';
  assert.deepEqual(parse(messy), parse(SMALL));
});

test('reports a hole in the outer wall', () => {
  failsWith(SMALL.replace('#S', ' S'), /Уровень 7: строка 2, символ 1: дыра во внешней стене/);
});

test('reports look-alike Cyrillic letters', () => {
  failsWith(SMALL.replace('F', 'С'), /непонятный символ "С"/);
});

test('reports a cell marker on a wall position', () => {
  failsWith(SMALL.replace('##### #', '#####S#'), /"S" стоит на месте стены/);
});

test('requires exactly one start and one rocket', () => {
  failsWith(SMALL.replace('F', 'S'), /стартов S: 2/);
  failsWith(SMALL.replace('R', ' '), /ракет R: 0/);
});

test('reports an unreachable rocket', () => {
  failsWith(SMALL.replace('##### #', '#######'), /до ракеты не доехать/);
});

test('reports uneven and even-sized maps', () => {
  failsWith(SMALL.replace('#S   F#', '#S   F #'), /строка 2 длиной 8, а первая — 7/);
  failsWith('\n####\n#SR#\n####\n', /нечётным/);
});

test('reports an empty level left by a stray comma', () => {
  assert.throws(() => parseLevel(undefined, 3, PLANET_KEYS), /Уровень 3: пустой уровень/);
  assert.throws(() => parseLevel(null, 3, PLANET_KEYS), /лишняя запятая/);
});

test('reports an unknown planet', () => {
  failsWith(SMALL, /неизвестная планета "venus"/, 'venus');
});

test('levelDistances gives distance and first step for every reachable cell', () => {
  const { maze, start } = parse(SMALL);
  const dist = levelDistances(maze, start);
  assert.equal(dist.size, 6);
  assert.deepEqual(dist.get('0,1'), { dist: 5, first: 'right' });
});

test('dark and storm are optional and checked', () => {
  const level = parse(SMALL);
  assert.equal(level.dark, false);
  assert.equal(level.storm, null);
  assert.equal(parseLevel({ planet: 'moon', map: SMALL, dark: true }, 1, PLANET_KEYS).dark, true);
  assert.deepEqual(parseLevel({ planet: 'mars', map: SMALL, storm: { from: 0, to: 1 } }, 1, PLANET_KEYS).storm, { from: 0, to: 3 }, 'in cell columns');
  assert.throws(() => parseLevel({ planet: 'moon', map: SMALL, dark: 'yes' }, 1, PLANET_KEYS), /dark/);
  assert.throws(() => parseLevel({ planet: 'mars', map: SMALL, storm: 0.5 }, 1, PLANET_KEYS), /storm/);
  assert.throws(() => parseLevel({ planet: 'mars', map: SMALL, storm: { from: 0.7, to: 0.2 } }, 1, PLANET_KEYS), /storm/);
});

test('landmark letters come from the registry and are unique', async () => {
  const { LANDMARKS, LANDMARK_BY_CHAR } = await import('../js/landmarks.js');
  const lettered = Object.entries(LANDMARKS).filter(([, l]) => l.char);
  assert.equal(Object.keys(LANDMARK_BY_CHAR).length, lettered.length);
  for (const [type, l] of Object.entries(LANDMARKS)) {
    if (l.char) assert.equal(LANDMARK_BY_CHAR[l.char], type);
    assert.equal(typeof l.draw, 'function');
    assert.equal(typeof l.chime, 'boolean');
  }
  const level = parse(SMALL.replace('F', 'A'));
  assert.deepEqual(level.landmarks, [{ type: 'antenna', x: 2, y: 0 }]);
});

// Two ways round: the top corridor and the bottom one, so walling M off still leaves a route.
const LOOP = `
#################
#S   T     M   R#
# ############# #
#               #
#################
`;

test('a meteor needs one M and one T, far enough apart, with a way round', () => {
  const level = parseLevel({ planet: 'moon', map: LOOP }, 1, PLANET_KEYS);
  assert.deepEqual(level.meteor, { cell: { x: 5, y: 0 }, trigger: { x: 2, y: 0 } });
  assert.equal(parse(SMALL).meteor, null);
  const atStart = parseLevel({ planet: 'moon', map: LOOP.replace('T', ' ') }, 1, PLANET_KEYS);
  assert.deepEqual(atStart.meteor, { cell: { x: 5, y: 0 }, trigger: null }, 'no T: goes off at the start');
  failsWith(LOOP.replace('M', ' '), /ровно одна M/);
  failsWith(LOOP.replace('T', ' ').replace('S   ', 'S M ').replace('   M', '    '), /от старта/);
  failsWith(LOOP.replace('T     M', 'T M    '), /не ближе/);
  failsWith(LOOP.replace('#               #', '#       #       #'), /после падения метеорита/);
});

test('blockCell walls a cell off from both sides', () => {
  const { maze } = parse(SMALL);
  const blocked = blockCell(maze, { x: 1, y: 0 });
  assert.ok(blocked.cells[0][1].left && blocked.cells[0][1].right);
  assert.ok(blocked.cells[0][0].right && blocked.cells[0][2].left);
  assert.equal(maze.cells[0][0].right, false, 'the original is untouched');
});

test('a meteor is refused under a veil, and an unreachable M says so', () => {
  assert.throws(() => parseLevel({ planet: 'moon', map: LOOP, dark: true }, 1, PLANET_KEYS), /ночном уровне/);
  assert.throws(() => parseLevel({ planet: 'mars', map: LOOP, storm: { from: 0, to: 1 } }, 1, PLANET_KEYS), /бурю/);
  // M in a pocket of its own: the parser must not call it "too close".
  const pocket = LOOP.replace('#S   T     M   R#', '#S   T    #M#  R#');
  assert.throws(() => parseLevel({ planet: 'moon', map: pocket }, 1, PLANET_KEYS), /не доехать/);
});

test('smokers stand on the floor of their cell', () => {
  const ocean = floor => `
#######
#R W B#
${floor}
#S    #
#######
`;
  const level = parse(ocean('# #####'), 'enceladus');
  assert.deepEqual(level.smokers, [{ x: 1, y: 0, white: true }, { x: 2, y: 0, white: false }]);
  failsWith(ocean('# ### #'), /строка 2, символ 6: курильщик B стоит на дне, а под ним нет стены/, 'enceladus');
});

test('under water the rocket is in the top row, and top-down things are refused', () => {
  const ocean = `
#######
#    R#
# #####
#S F  #
#######
`;
  failsWith(ocean.replace('F', ' ').replace('R', ' ').replace('#S  ', '#S R'), /ракета R стоит на льду/, 'enceladus');
  failsWith(ocean, /под водой ориентира F нет/, 'enceladus');
  assert.equal(parse(ocean.replace('F', 'Z'), 'enceladus').landmarks[0].type, 'station');
  failsWith(ocean.replace('F', 'Z'), /ориентир Z бывает только под водой/, 'moon');
  assert.equal(parse(ocean.replace('F', ' '), 'enceladus').goal.y, 0);
  failsWith(ocean.replace('F', 'W'), /курильщики W и B бывают только под водой/, 'moon');
});

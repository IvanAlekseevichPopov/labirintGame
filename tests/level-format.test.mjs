import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, levelDistances } from '../level-format.js';
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
  assert.deepEqual(parseLevel({ planet: 'mars', map: SMALL, storm: { from: 0, to: 0.5 } }, 1, PLANET_KEYS).storm, { from: 0, to: 0.5 });
  assert.throws(() => parseLevel({ planet: 'moon', map: SMALL, dark: 'yes' }, 1, PLANET_KEYS), /dark/);
  assert.throws(() => parseLevel({ planet: 'mars', map: SMALL, storm: 0.5 }, 1, PLANET_KEYS), /storm/);
  assert.throws(() => parseLevel({ planet: 'mars', map: SMALL, storm: { from: 0.7, to: 0.2 } }, 1, PLANET_KEYS), /storm/);
});

test('landmark letters come from the registry and are unique', async () => {
  const { LANDMARKS, LANDMARK_BY_CHAR } = await import('../js/landmarks.js');
  assert.equal(Object.keys(LANDMARK_BY_CHAR).length, Object.keys(LANDMARKS).length);
  for (const [type, l] of Object.entries(LANDMARKS)) {
    assert.equal(LANDMARK_BY_CHAR[l.char], type);
    assert.equal(typeof l.draw, 'function');
    assert.equal(typeof l.chime, 'boolean');
  }
  const level = parse(SMALL.replace('F', 'A'));
  assert.deepEqual(level.landmarks, [{ type: 'antenna', x: 2, y: 0 }]);
});

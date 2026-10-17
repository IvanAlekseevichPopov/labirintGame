import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORM, stormOutline } from '../js/storm.js';
import { STORM_MIN_CELLS, parseLevel } from '../level-format.js';
import { LEVELS } from '../levels.js';
import { PLANET_KEYS } from '../js/planets.js';
import { createClock, jitter } from '../js/veil.js';

const CELL = 100;
const AREA = { x: 200, y: 100, w: 14 * CELL, h: 7 * CELL, cols: 14 };
const TIMES = Array.from({ length: 600 }, (_, i) => i * 97);

test('a storm touching an edge of the maze runs off it on that side', () => {
  const { left, x0 } = stormOutline({ from: 0, to: 7 }, AREA, CELL, 0);
  assert.equal(left.length, 2);
  assert.ok(left.every(([x]) => x < AREA.x) && x0 < AREA.x);
  const { right, x1 } = stormOutline({ from: 7, to: 14 }, AREA, CELL, 0);
  assert.equal(right.length, 2);
  assert.ok(right.every(([x]) => x > AREA.x + AREA.w) && x1 > AREA.x + AREA.w);
});

test('the fronts billow inside the storm cells and never over the cells outside', () => {
  const span = { from: 4, to: 4 + STORM_MIN_CELLS };
  for (const now of TIMES) {
    const { left, right, x0, x1 } = stormOutline(span, AREA, CELL, now);
    assert.equal(x0, AREA.x + 4 * CELL);
    assert.equal(x1, AREA.x + (4 + STORM_MIN_CELLS) * CELL);
    for (const [x] of left) assert.ok(x >= x0 - 1e-9 && x <= x0 + CELL * STORM.edge * 2.8);
    for (const [x] of right) assert.ok(x <= x1 + 1e-9 && x >= x1 - CELL * STORM.edge * 2.8);
    left.forEach(([x], i) => assert.ok(x < right[i][0], `fronts cross at t=${now}`));
  }
});

test('on level 23 the drawn storm and the cells that count as inside agree', () => {
  const level = parseLevel(LEVELS[22], 23, PLANET_KEYS);
  const area = { ...AREA, cols: level.maze.cols, w: level.maze.cols * CELL };
  for (const now of TIMES) {
    const { polygon, x1 } = stormOutline(level.storm, area, CELL, now);
    assert.ok(polygon.every(([x]) => x <= x1 + 1e-9));
  }
  assert.equal(x1OfCell(level.storm.to), level.storm.to * CELL + AREA.x);
  function x1OfCell(col) { return AREA.x + col * CELL; }
});

test('the parser snaps a storm to cell columns and refuses one too narrow', () => {
  const { map } = LEVELS[21];
  assert.deepEqual(parseLevel({ planet: 'mars', map, storm: { from: 0, to: 0.58 } }, 23, PLANET_KEYS).storm, { from: 0, to: 8 });
  assert.throws(() => parseLevel({ planet: 'mars', map, storm: { from: 0.5, to: 0.6 } }, 23, PLANET_KEYS), /буря уже/);
});

test('the veil clock starts at zero and caps a long gap', () => {
  const clock = createClock();
  assert.equal(clock(1000), 0);
  assert.ok(Math.abs(clock(1016) - 0.016) < 1e-9);
  assert.equal(clock(9000), 0.05);
  assert.equal(clock(8000), 0, 'time never runs backwards');
});

test('jitter stays in [0, 1)', () => {
  for (const now of TIMES) { const j = jitter(now); assert.ok(j >= 0 && j < 1, `${now}: ${j}`); }
});

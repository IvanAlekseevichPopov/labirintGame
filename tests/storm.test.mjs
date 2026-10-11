import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORM, stormOutline } from '../js/storm.js';
import { STORM_MIN_CELLS, parseLevel } from '../level-format.js';
import { LEVELS } from '../levels.js';
import { PLANET_KEYS } from '../js/planets.js';

const CELL = 100;
const AREA = { x: 200, y: 100, w: 14 * CELL, h: 7 * CELL, cols: 14 };

test('a storm from the left edge runs off the maze on that side', () => {
  const { left, x0 } = stormOutline({ from: 0, to: 0.5 }, AREA, CELL, 0);
  assert.equal(left.length, 2);
  assert.ok(left.every(([x]) => x < AREA.x));
  assert.ok(x0 < AREA.x);
});

test('fronts stay within their reach and never cross at the minimum width', () => {
  const span = { from: 0.3, to: 0.3 + STORM_MIN_CELLS / AREA.cols };
  const reach = CELL * STORM.edge * 1.4 + 1e-6;
  for (let now = 0; now < 60000; now += 97) {
    const { left, right, x0, x1 } = stormOutline(span, AREA, CELL, now);
    const lx = AREA.x + AREA.w * span.from, rx = AREA.x + AREA.w * span.to;
    for (const [x] of left) assert.ok(Math.abs(x - lx) <= reach && x >= x0);
    for (const [x] of right) assert.ok(Math.abs(x - rx) <= reach && x <= x1);
    left.forEach(([x], i) => assert.ok(x < right[i][0], `fronts cross at t=${now}`));
  }
});

test('the parser refuses a storm too narrow for its fronts', () => {
  const { map } = LEVELS[22];
  assert.ok(parseLevel({ planet: 'mars', map, storm: { from: 0, to: 0.58 } }, 23, PLANET_KEYS).storm);
  assert.throws(() => parseLevel({ planet: 'mars', map, storm: { from: 0.5, to: 0.6 } }, 23, PLANET_KEYS), /буря уже/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFront, drawProfile } from '../js/profiles.js';

// Records every number passed to the context, so a NaN that the canvas would silently skip shows.
function recorder() {
  const numbers = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (key === 'createLinearGradient' || key === 'createRadialGradient'
      ? () => ({ addColorStop() {} })
      : (...args) => { for (const a of args) if (typeof a === 'number') numbers.push(a); }),
    set: () => true,
  });
  return { ctx, numbers };
}

for (const type of ['lunokhod', 'marsRover', 'icebreaker', 'drone']) {
  test(`${type} in profile draws with real numbers, on flat ground and on a globe`, () => {
    for (const options of [{}, { rolled: 3.2, spokes: 1, ground: 120 }]) {
      const { ctx, numbers } = recorder();
      drawProfile(ctx, type, 100, 200, 80, options);
      assert.ok(numbers.length > 0);
      assert.ok(numbers.every(Number.isFinite), `${type} ${JSON.stringify(options)}`);
    }
  });
}

test('the drone head-on draws with real numbers', () => {
  const { ctx, numbers } = recorder();
  drawFront(ctx, 'drone', 100, 200, 80);
  assert.ok(numbers.length > 0);
  assert.ok(numbers.every(Number.isFinite));
});

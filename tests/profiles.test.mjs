import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawBeam, drawProfile } from '../js/profiles.js';
import { ROVERS } from '../js/rovers.js';
import { PLANETS } from '../js/planets.js';

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

for (const type of Object.keys(ROVERS)) {
  test(`${type} in profile draws with real numbers, on flat ground and on a globe`, () => {
    for (const options of [{}, { rolled: 3.2, spokes: 1, ground: 120 }]) {
      const { ctx, numbers } = recorder();
      drawProfile(ctx, ROVERS[type].profile, 100, 200, 80, options);
      assert.ok(numbers.length > 0);
      assert.ok(numbers.every(Number.isFinite), `${type} ${JSON.stringify(options)}`);
    }
  });
}

test('the drone head-on and its beam draw with real numbers', () => {
  const { ctx, numbers } = recorder();
  drawProfile(ctx, ROVERS.drone.front, 100, 200, 80);
  drawBeam(ctx, ROVERS.drone.beam, 100, 200, 80);
  assert.ok(numbers.length > 0);
  assert.ok(numbers.every(Number.isFinite));
});

test('every planet\'s machine is in the registry with what its view needs', () => {
  for (const [planet, p] of Object.entries(PLANETS)) {
    const rover = ROVERS[p.rover];
    assert.ok(rover, `${planet}: ${p.rover}`);
    assert.equal(typeof rover.profile, 'function', `${p.rover} in profile`);
    assert.equal(typeof rover.engine, 'function', `${p.rover} engine`);
    if (p.side) assert.ok(rover.front && rover.beam, `${p.rover} turns round and lights its way`);
    else assert.equal(typeof rover.top, 'function', `${p.rover} from above`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METEOR } from '../js/config.js';
import { meteorLights, meteorShake } from '../js/meteor.js';

test('the ground shakes only right after a hit, and settles', () => {
  const meteor = [{ phase: 'fallen', at: 1000 }];
  assert.deepEqual(meteorShake([{ phase: 'falling', at: 1000 }], 1100, 100), [0, 0]);
  assert.deepEqual(meteorShake([], 1100, 100), [0, 0]);
  const [x, y] = meteorShake(meteor, 1010, 100);
  assert.ok(Math.hypot(x, y) > 0 && Math.hypot(x, y) <= 100 * 0.05 * Math.SQRT2);
  const [lx, ly] = meteorShake(meteor, 1000 + METEOR.shakeMs - 1, 100);
  assert.ok(Math.hypot(lx, ly) < Math.hypot(x, y));
  assert.deepEqual(meteorShake(meteor, 1000 + METEOR.shakeMs, 100), [0, 0]);
});

test('of two hits the ground shakes by the latest', () => {
  const later = [{ phase: 'fallen', at: 0 }, { phase: 'fallen', at: 1000 }];
  assert.deepEqual(meteorShake(later, 1010, 100), meteorShake([later[1]], 1010, 100));
  assert.deepEqual(meteorShake([{ phase: 'fallen', at: 1000 }, { phase: 'falling', at: 2000 }], 1010, 100), meteorShake([later[1]], 1010, 100));
});

test('a hit lights the dark round it for a moment, and nothing else does', () => {
  const toPx = ({ x, y }) => [x * 100, y * 100];
  const meteors = [{ phase: 'fallen', at: 1000, cell: { x: 2, y: 3 } }, { phase: 'falling', at: 1500, cell: { x: 5, y: 5 } }];
  const [flash] = meteorLights(meteors, 1000, 100, toPx);
  assert.deepEqual([flash.x, flash.y, flash.strength], [200, 300, 1]);
  assert.equal(meteorLights(meteors, 1000, 100, toPx).length, 1);
  assert.ok(meteorLights(meteors, 1500, 100, toPx)[0].strength < flash.strength);
  assert.deepEqual(meteorLights(meteors, 1000 + METEOR.flashMs, 100, toPx), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METEOR } from '../js/config.js';
import { meteorShake } from '../js/meteor.js';

test('the ground shakes only right after the hit, and settles', () => {
  const meteor = { phase: 'fallen', at: 1000 };
  assert.deepEqual(meteorShake({ phase: 'falling', at: 1000 }, 1100, 100), [0, 0]);
  assert.deepEqual(meteorShake(null, 1100, 100), [0, 0]);
  const [x, y] = meteorShake(meteor, 1010, 100);
  assert.ok(Math.hypot(x, y) > 0 && Math.hypot(x, y) <= 100 * 0.05 * Math.SQRT2);
  const [lx, ly] = meteorShake(meteor, 1000 + METEOR.shakeMs - 1, 100);
  assert.ok(Math.hypot(lx, ly) < Math.hypot(x, y));
  assert.deepEqual(meteorShake(meteor, 1000 + METEOR.shakeMs, 100), [0, 0]);
});

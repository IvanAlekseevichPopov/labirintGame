import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRILL_MS } from '../js/config.js';
import { createChips, drawIceWall, iceSegment } from '../js/ice.js';

const CELL = 60;
const VIEW = { cell: CELL, ox: 10, oy: 20 };

// Records every call made on the context, so a NaN that the canvas would silently skip shows.
function recorder() {
  const calls = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = new Proxy({}, {
    get: (_, key) => (key === 'createLinearGradient' || key === 'createRadialGradient' ? gradient
      : (...args) => { calls.push({ name: key, args }); }),
    set: () => true,
  });
  const numbers = () => calls.flatMap(c => c.args.filter(a => typeof a === 'number'));
  return { ctx, calls, numbers };
}

// Below the wall and to the right of it, so both kinds of wall are covered.
const wall = (across, damage, side) => {
  const a = { x: 2, y: 3 }, b = across ? { x: 3, y: 3 } : { x: 2, y: 4 };
  return { a, b, drilled: damage * DRILL_MS, from: side === 'a' ? a : side === 'b' ? b : undefined };
};

test('ice segments lie between the two cells', () => {
  assert.deepEqual(iceSegment(wall(true, 0)), [3, 3, 3, 4]);
  assert.deepEqual(iceSegment(wall(false, 0)), [2, 4, 3, 4]);
});

for (const across of [false, true]) {
  for (const [damage, side] of [[0, undefined], [0.5, 'a'], [0.5, 'b'], [0.99, 'a'], [0.99, 'b']]) {
    test(`an ice wall ${across ? 'between columns' : 'between rows'} drilled ${damage} from ${side ?? 'nowhere'} draws with real numbers`, () => {
      for (const drilling of [false, true]) {
        const { ctx, numbers } = recorder();
        drawIceWall(ctx, wall(across, damage, side), { ...VIEW, now: 1234, drilling });
        assert.ok(numbers().length > 0);
        assert.ok(numbers().every(Number.isFinite));
      }
    });
  }
}

test('an ice wall looks the same every time it is drawn, and drilling changes it', () => {
  const draw = (damage, side) => {
    const { ctx, numbers } = recorder();
    drawIceWall(ctx, wall(false, damage, side), { ...VIEW, now: 5000 });
    return numbers();
  };
  assert.deepEqual(draw(0.5, 'a'), draw(0.5, 'a'));
  assert.notDeepEqual(draw(0, undefined), draw(0.5, 'a'));
  assert.notDeepEqual(draw(0.5, 'a'), draw(0.5, 'b'));
});

const chipsDrawn = (chips, now) => {
  const { ctx, calls, numbers } = recorder();
  chips.draw(ctx, now, VIEW, false);
  chips.draw(ctx, now, VIEW, true);
  assert.ok(numbers().every(Number.isFinite));
  return calls.filter(c => c.name === 'fill').length;
};

test('ice crumbs fly only while the wall is drilled, and are gone soon after', () => {
  const chips = createChips();
  const drilled = wall(true, 0.3, 'b');
  for (let now = 0; now <= 500; now += 16) chips.update(now, null);
  assert.equal(chipsDrawn(chips, 500), 0);
  for (let now = 500; now <= 900; now += 16) chips.update(now, drilled);
  assert.ok(chipsDrawn(chips, 900) > 0);
  for (let now = 900; now <= 1500; now += 16) chips.update(now, null);
  assert.equal(chipsDrawn(chips, 1500), 0);
});

test('a broken wall bursts into a few shards, all off the far side from the rover, gone in a second and a half', () => {
  const chips = createChips();
  chips.update(0, null);
  chips.burst(0, wall(false, 1, 'a'));
  for (let now = 16; now <= 600; now += 16) chips.update(now, null);
  const { ctx, calls } = recorder();
  chips.draw(ctx, 600, VIEW, true);
  const shadows = calls.filter(c => c.name === 'ellipse');
  assert.ok(shadows.length >= 5 && shadows.length <= 12);
  // The rover is in cell a, above the wall at y = 4.
  assert.ok(shadows.every(({ args: [, y] }) => y > VIEW.oy + 3.9 * CELL));
  for (let now = 616; now <= 1500; now += 16) chips.update(now, null);
  assert.equal(chipsDrawn(chips, 1500), 0);
  chips.burst(1500, wall(true, 1, 'b'));
  chips.reset();
  assert.equal(chipsDrawn(chips, 1500), 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS } from '../js/planets.js';
import {
  crustCracks, drawFrost, drawGrowths, drawIceCrust, drawPebbles, drawProbe, drawProbeLight, drawRockMass, drawSmoke,
  drawSmoker, fillWater, wallTint,
} from '../js/ocean.js';
import { createBubbles } from '../js/bubbles.js';
import { createSilt } from '../js/silt.js';

const p = PLANETS.enceladus;
const CELL = 60;

// Records every call made on the context, so a NaN that the canvas would silently skip shows, and
// where things were drawn can be checked.
function recorder() {
  const calls = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = new Proxy({}, {
    get: (_, key) => (key === 'createLinearGradient' || key === 'createRadialGradient' ? gradient
      : key === 'getTransform' ? () => ({}) : (...args) => { calls.push({ name: key, args }); }),
    set: () => true,
  });
  const numbers = () => calls.flatMap(c => c.args.filter(a => typeof a === 'number'));
  return { ctx, calls, numbers };
}

// What the browser has and node does not, just enough for the drawing code to run.
globalThis.Path2D ??= class { arc() {} lineTo() {} moveTo() {} closePath() {} };
globalThis.devicePixelRatio ??= 2;
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => recorder().ctx }) };

const finite = (name, draw) => test(`${name} draws with real numbers`, () => {
  const { ctx, numbers } = recorder();
  draw(ctx);
  assert.ok(numbers().length > 0);
  assert.ok(numbers().every(Number.isFinite));
});

// A 3×2 maze's wall segments in grid units: the frame and one wall inside.
const SEGMENTS = [[0, 0, 1, 0], [1, 0, 2, 0], [2, 0, 3, 0], [0, 0, 0, 1], [0, 1, 0, 2], [3, 0, 3, 1], [3, 1, 3, 2],
  [0, 2, 1, 2], [1, 2, 2, 2], [2, 2, 3, 2], [1, 1, 2, 1], [2, 0, 2, 1]];
const paint = { base: '#000', top: '#fff' };

finite('the water', g => fillWater(g, p, { x: 10, y: 20, w: 300, h: 200, cell: CELL, surface: 30, cracks: [50, 200] }));
finite('the rock round the maze', g => drawRockMass(g, p, { frame: { x: 10, y: 20, w: 300, h: 200 }, side: 27, bottom: 33, cell: CELL, seed: 18, paint }));
finite('the ice crust', g => drawIceCrust(g, p, { x: 0, w: 320, top: 0, bottom: 40, cell: CELL, seed: 18, cracks: [60, 250], hole: 160 }));
finite('frost on the joints', g => drawFrost(g, p, SEGMENTS, { cell: CELL, ox: 10, oy: 20, rows: 2, seed: 18 }));
finite('growths on the walls', g => drawGrowths(g, p, SEGMENTS, { cell: CELL, ox: 10, oy: 20, cols: 3, rows: 2, half: 8, seed: 18, clear: () => false }));
finite('a white smoker', g => drawSmoker(g, p, { x: 90, line: 140, half: 8, cell: CELL, white: true }));
finite('a black smoker', g => drawSmoker(g, p, { x: 90, line: 140, half: 8, cell: CELL, white: false }));
finite('pebbles', g => drawPebbles(g, p, { x: 10, w: 180, floor: 132, cell: CELL, seed: 18, clear: [90] }));
finite('the smoke', g => drawSmoke(g, [{ x: 90, y: 110, white: true }, { x: 150, y: 110, white: false }], 4000, CELL));
finite('the docking bell', g => drawProbe(g, 90, 50, 0, CELL, 1234));
finite('the bell\'s light', g => drawProbeLight(g, 90, 50, CELL, 1234));

test('the decor of a level is the same every time it is drawn', () => {
  const draw = () => {
    const { ctx, numbers } = recorder();
    drawGrowths(ctx, p, SEGMENTS, { cell: CELL, ox: 10, oy: 20, cols: 3, rows: 2, half: 8, seed: 18, clear: () => false });
    drawFrost(ctx, p, SEGMENTS, { cell: CELL, ox: 10, oy: 20, rows: 2, seed: 18 });
    return numbers();
  };
  assert.deepEqual(draw(), draw());
});

test('no light shaft falls across the probe\'s shaft in the ice', () => {
  const hole = 500;
  for (let seed = 0; seed < 40; seed++) {
    for (const cx of crustCracks(seed, 0, 1200, CELL, hole)) assert.ok(cx < hole - CELL * 2 || cx > hole + CELL * 0.7, `seed ${seed}`);
  }
});

test('walls are icy under the crust and rocky by the floor', () => {
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  assert.deepEqual(wallTint(p, 0), { base: rgb(p.iceWall), top: rgb(p.iceWallTop) });
  assert.deepEqual(wallTint(p, 1), { base: rgb(p.wallBase), top: rgb(p.wallTop) });
});

test('bubbles come only while the drone swims, rise, and are gone soon after', () => {
  const bubbles = createBubbles();
  const view = { cell: CELL, ox: 0, oy: 0 };
  const at = { screw: { x: 2, y: 3 }, back: -1, active: true };
  for (let now = 0; now <= 1000; now += 16) bubbles.update(now, { ...at, swimming: false });
  assert.equal(bubbles.bounds(view), null);
  for (let now = 1000; now <= 1500; now += 16) bubbles.update(now, { ...at, swimming: true });
  const box = bubbles.bounds(view);
  assert.ok(box && box.y < 3 * CELL, 'some bubbles are out and above the screw');
  for (let now = 1500; now <= 5000; now += 16) bubbles.update(now, { ...at, swimming: false });
  assert.equal(bubbles.bounds(view), null);
});

test('silt is stirred only over a ledge, and its grains never sink into the floor', () => {
  const silt = createSilt();
  const view = { cell: CELL, ox: 0, oy: 0 };
  const stir = { wash: 2, back: -1, stirring: true, murk: '1, 2, 3', grain: '4, 5, 6' };
  for (let now = 0; now <= 500; now += 16) silt.update(now, { ...stir, floor: null });
  assert.equal(silt.bounds(view), null);
  const floor = 2.87;
  let grains = 0;
  for (let now = 500; now <= 4000; now += 16) {
    silt.update(now, { ...stir, floor, stirring: now < 1500 });
    const { ctx, calls } = recorder();
    silt.draw(ctx, now, view);
    for (const { name, args } of calls.filter(c => c.name === 'arc')) {
      grains++;
      assert.ok(args[1] <= floor * CELL + 1e-9, `grain at ${args[1]} at ${now}`);
    }
  }
  assert.ok(grains > 0);
});

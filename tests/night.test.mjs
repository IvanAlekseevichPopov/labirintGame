import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT, beamPolygon, brightness, castRay } from '../js/night.js';

// A 100 px square room with a wall across the middle, as px segments [x0, y0, x1, y1].
const BOX = [[0, 0, 100, 0], [100, 0, 100, 100], [0, 100, 100, 100], [0, 0, 0, 100]];
const WALL = [50, 20, 50, 100];

test('castRay stops at the nearest wall in its direction, or at its reach', () => {
  assert.equal(castRay(10, 50, 1, 0, 500, [...BOX, WALL]), 40);
  assert.equal(castRay(10, 50, -1, 0, 500, [...BOX, WALL]), 10);
  assert.equal(castRay(10, 10, 1, 0, 500, [...BOX, WALL]), 90, 'passes the gap above the wall');
  assert.equal(castRay(10, 50, 1, 0, 25, [...BOX, WALL]), 25, 'short reach');
  assert.equal(castRay(10, 50, 0, 1, 500, []), 500, 'no walls');
});

test('beamPolygon is the lamp plus one point per ray, none past a wall', () => {
  const pts = beamPolygon(10, 50, 0, 500, [...BOX, WALL]);
  assert.equal(pts.length, NIGHT.rays + 2);
  assert.deepEqual(pts[0], [10, 50]);
  for (const [x, y] of pts.slice(1)) {
    assert.ok(x <= 50 + 1e-9 && x >= 0 && y >= 0 && y <= 100, `point ${x},${y} escaped`);
  }
});

test('headlights are off, then flicker, then hold', () => {
  assert.equal(brightness(-1, 0), 0);
  assert.ok(brightness(10, 0) > 0.9);
  assert.ok(brightness(100, 0) < 0.2, 'first blink');
  assert.ok(brightness(1000, 0) > 0.9);
  assert.ok(brightness(1000, 5000) > 0.9);
});

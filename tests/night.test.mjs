import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEADLIGHTS, beamPolygon, castRay, headlightPreset } from '../js/headlights.js';
import { brightness } from '../js/night.js';

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
  const pts = beamPolygon(10, 50, 0, 500, [...BOX, WALL], headlightPreset('night', 'moon'));
  assert.equal(pts.length, headlightPreset('night', 'moon').rays + 2);
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

test('a planet can override one dust or tail field without losing the rest', () => {
  HEADLIGHTS.storm.test = { dust: { count: 80 }, tail: { r: 0.2 } };
  const p = headlightPreset('storm', 'test');
  delete HEADLIGHTS.storm.test;
  assert.equal(p.dust.kind, 'sand');
  assert.equal(p.dust.count, 80);
  assert.ok(p.dust.wind > 0);
  assert.equal(p.tail.r, 0.2);
  assert.ok(p.tail.color);
  HEADLIGHTS.night.test = { dust: null };
  assert.equal(headlightPreset('night', 'test').dust, null);
  delete HEADLIGHTS.night.test;
});

test('headlight presets fill in from the defaults and can drop the dust', () => {
  const moon = headlightPreset('night', 'moon');
  const storm = headlightPreset('storm', 'mars');
  assert.equal(moon.dust.kind, 'motes');
  assert.equal(storm.dust.kind, 'sand');
  assert.ok(storm.rays > 0 && storm.halfAngle > 0, 'shape comes from the defaults');
  for (const veil of Object.keys(HEADLIGHTS)) assert.ok(headlightPreset(veil, 'nowhere').reach > 0);
});

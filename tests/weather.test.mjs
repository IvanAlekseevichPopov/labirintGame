import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeather, weatherIntensity, WEATHER_FROM_LEVEL } from '../js/weather.js';
import { PLANET_KEYS, PLANETS } from '../js/planets.js';

const TOP_DOWN = PLANET_KEYS.filter(p => !PLANETS[p].side);

test('weather starts at level 20, light, and is full by the last level', () => {
  assert.equal(weatherIntensity(WEATHER_FROM_LEVEL - 1), 0);
  assert.equal(weatherIntensity(WEATHER_FROM_LEVEL), 0.3);
  assert.equal(weatherIntensity(40), 1);
  assert.equal(createWeather('mars', 0), null);
  assert.equal(createWeather('enceladus', 1), null);
});

// A canvas stand-in that accepts any drawing call and counts them.
function fakeContext() {
  let calls = 0;
  const ctx = new Proxy({}, {
    get: (target, key) => key === 'calls' ? calls : key in target ? target[key] : () => {
      calls++;
      return { addColorStop() {} };
    },
    set: (target, key, value) => (target[key] = value, true),
  });
  return ctx;
}

for (const planet of TOP_DOWN) {
  test(`${planet} weather runs for a while and draws something`, () => {
    const draw = createWeather(planet, 1);
    const ctx = fakeContext();
    const screen = { w: 1920, h: 1080 };
    const area = { x: 100, y: 120, w: 1700, h: 900, cell: 85 };
    for (let now = 0; now < 15000; now += 16) draw(ctx, now, screen, area);
    assert.ok(ctx.calls > 0);
  });
}

// The canvas ignores a globalAlpha outside 0..1 and keeps the previous one, often full: a fading
// dust devil drawn at -0.01 flashed at full brightness for a frame before it vanished.
for (const planet of TOP_DOWN) {
  test(`${planet} weather never sets an alpha the canvas would ignore`, () => {
    const draw = createWeather(planet, 1);
    const bad = [];
    const ctx = new Proxy({}, {
      get: (target, key) => key in target ? target[key] : () => ({ addColorStop() {} }),
      set: (target, key, value) => {
        if (key === 'globalAlpha' && !(value >= 0 && value <= 1)) bad.push(value);
        target[key] = value;
        return true;
      },
    });
    const screen = { w: 1920, h: 1080 };
    const area = { x: 100, y: 120, w: 1700, h: 900, cell: 85 };
    for (let now = 0; now < 60000; now += 16) draw(ctx, now, screen, area);
    assert.deepEqual(bad, []);
  });
}

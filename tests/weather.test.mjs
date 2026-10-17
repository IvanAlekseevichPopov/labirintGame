import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeather, weatherIntensity, WEATHER_FROM_LEVEL } from '../js/weather.js';
import { PLANET_KEYS } from '../js/planets.js';

test('weather starts at level 20, light, and is full by the last level', () => {
  assert.equal(weatherIntensity(WEATHER_FROM_LEVEL - 1, 40), 0);
  assert.equal(weatherIntensity(WEATHER_FROM_LEVEL, 40), 0.3);
  assert.equal(weatherIntensity(40, 40), 1);
  assert.equal(createWeather('mars', 0), null);
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

// Enceladus has no weather yet.
for (const planet of PLANET_KEYS.filter(p => p !== 'enceladus')) {
  test(`${planet} weather runs for a while and draws something`, () => {
    const draw = createWeather(planet, 1);
    const ctx = fakeContext();
    const screen = { w: 1920, h: 1080 };
    const area = { x: 100, y: 120, w: 1700, h: 900, cell: 85 };
    for (let now = 0; now < 15000; now += 16) draw(ctx, now, screen, area);
    assert.ok(ctx.calls > 0);
  });
}

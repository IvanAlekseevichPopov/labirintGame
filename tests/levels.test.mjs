import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, PLANETS } from './helpers.mjs';

// levels.js is curated by hand, so these checks hold for any valid set, not a particular one.
const { LEVELS, parseLevel } = loadScripts(['level-format.js', 'levels.js'], '{ LEVELS, parseLevel }');

test('levels.js defines at least one level', () => {
  assert.ok(Array.isArray(LEVELS) && LEVELS.length > 0);
});

// Array.from turns holes (a stray comma) into undefined instead of skipping them like forEach.
Array.from(LEVELS).forEach((level, i) => {
  test(`level ${i + 1} is valid`, () => {
    parseLevel(level, i + 1, PLANETS);
  });
});

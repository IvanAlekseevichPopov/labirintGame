import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { featuresDoc } from '../tools/features.mjs';

test('FEATURES.md is up to date with levels.js (node tools/features.mjs rewrites it)', () => {
  assert.equal(fs.readFileSync(new URL('../FEATURES.md', import.meta.url), 'utf8'), featuresDoc());
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, PLANETS, loadFormat } from './helpers.mjs';

// The generator writes next to itself, so run a copy in a temp dir to keep the real levels.js intact.
let dir, script, out;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'labirint-gen-'));
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(fileURLToPath(new URL('tools/gen-levels.mjs', ROOT)), path.join(dir, 'tools', 'gen-levels.mjs'));
  fs.copyFileSync(fileURLToPath(new URL('level-format.js', ROOT)), path.join(dir, 'level-format.js'));
  script = path.join(dir, 'tools', 'gen-levels.mjs');
  out = path.join(dir, 'levels.js');
  execFileSync(process.execPath, [script], { stdio: 'pipe' });
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

const readLevels = () => {
  const { parseLevel } = loadFormat();
  const source = fs.readFileSync(out, 'utf8');
  return { source, levels: new Function(`${source}; return LEVELS;`)(), parseLevel };
};

test('refuses to overwrite levels.js without --force', () => {
  const before = fs.readFileSync(out, 'utf8');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--force/);
  assert.equal(fs.readFileSync(out, 'utf8'), before);
});

test('is deterministic', () => {
  const first = fs.readFileSync(out, 'utf8');
  execFileSync(process.execPath, [script, '--force'], { stdio: 'pipe' });
  assert.equal(fs.readFileSync(out, 'utf8'), first);
  assert.ok(!fs.existsSync(`${out}.tmp`));
});

test('--only regenerates the listed levels and keeps hand edits elsewhere', () => {
  const { source, levels } = readLevels();
  // Stand-ins for hand edits: level 3 and level 7 get other valid mazes.
  fs.writeFileSync(out, source.replace(levels[2].map, levels[1].map).replace(levels[6].map, levels[0].map));
  execFileSync(process.execPath, [script, '--only', '3'], { stdio: 'pipe' });

  const after = readLevels().levels;
  assert.equal(after[2].map.trim(), levels[2].map.trim(), 'level 3 regenerated');
  assert.equal(after[6].map.trim(), levels[0].map.trim(), 'level 7 hand edit kept');
  execFileSync(process.execPath, [script, '--force'], { stdio: 'pipe' });
});

test('generates 40 valid levels cycling planets in blocks of 3', () => {
  const { levels, parseLevel } = readLevels();
  assert.equal(levels.length, 40);
  levels.forEach((level, i) => {
    parseLevel(level, i + 1, PLANETS);
    assert.equal(level.planet, PLANETS[Math.floor(i / 3) % PLANETS.length], `level ${i + 1}`);
  });
});

test('routes get longer from the first levels to the last', () => {
  const { levels, parseLevel } = readLevels();
  const { levelDistances } = loadFormat();
  const pathLength = i => {
    const { maze, start, goal } = parseLevel(levels[i], i + 1, PLANETS);
    return levelDistances(maze, start).get(`${goal.x},${goal.y}`).dist;
  };
  const avg = idx => idx.reduce((sum, i) => sum + pathLength(i), 0) / idx.length;
  assert.ok(avg([0, 1, 2, 3, 4]) <= 15);
  assert.ok(avg([35, 36, 37, 38, 39]) >= 50);
});

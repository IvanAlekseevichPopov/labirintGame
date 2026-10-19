import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLevel, levelDistances } from '../level-format.js';
import { PLANETS, PLANET_KEYS } from '../js/planets.js';
import { LEVELS } from '../levels.js';

const ROOT = new URL('../', import.meta.url);

// The generator writes next to itself, so run a copy in a temp dir to keep the real levels.js intact.
let dir, script, locked, out;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'labirint-gen-'));
  // The whole project minus levels.js, so whatever the generator imports is there.
  const root = fileURLToPath(ROOT);
  fs.cpSync(root, dir, {
    recursive: true,
    filter: src => !/\/(\.git|\.idea|node_modules)(\/|$)/.test(src) && src !== path.join(root, 'levels.js'),
  });
  script = path.join(dir, 'tools', 'gen-levels.mjs');
  // The real generator locks hand-made levels; the tests of generation itself run with the lock off.
  locked = path.join(dir, 'tools', 'gen-levels-locked.mjs');
  fs.copyFileSync(script, locked);
  fs.writeFileSync(script, fs.readFileSync(script, 'utf8').replace(/const LOCKED = \[[^\]]*\];/, 'const LOCKED = [];'));
  out = path.join(dir, 'levels.js');
  execFileSync(process.execPath, [script], { stdio: 'pipe' });
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

// A fresh query string per read: import() caches modules by URL.
let reads = 0;
const readLevels = async () => ({
  source: fs.readFileSync(out, 'utf8'),
  levels: (await import(`${pathToFileURL(out).href}?read=${++reads}`)).LEVELS,
});

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

test('--only regenerates the listed levels and keeps hand edits elsewhere', async () => {
  const { source, levels } = await readLevels();
  // Stand-ins for hand edits: level 3 and level 7 get other valid mazes.
  fs.writeFileSync(out, source.replace(levels[2].map, levels[1].map).replace(levels[6].map, levels[0].map));
  execFileSync(process.execPath, [script, '--only', '3'], { stdio: 'pipe' });

  const after = (await readLevels()).levels;
  assert.equal(after[2].map.trim(), levels[2].map.trim(), 'level 3 regenerated');
  assert.equal(after[6].map.trim(), levels[0].map.trim(), 'level 7 hand edit kept');
  execFileSync(process.execPath, [script, '--force'], { stdio: 'pipe' });
});

test('--only keeps the notes of the other levels and drops the regenerated one\'s', async () => {
  const { source } = await readLevels();
  fs.writeFileSync(out, source.replace('  // 3\n', '  // 3 — old maze\n').replace('  // 7\n', '  // 7 — hand-made\n'));
  execFileSync(process.execPath, [script, '--only', '3'], { stdio: 'pipe' });
  const after = fs.readFileSync(out, 'utf8');
  assert.match(after, /^ {2}\/\/ 7 — hand-made$/m);
  assert.match(after, /^ {2}\/\/ 3$/m);
  execFileSync(process.execPath, [script, '--force'], { stdio: 'pipe' });
});

test('--only keeps dark and storm flags, on the regenerated level too', async () => {
  const { source } = await readLevels();
  fs.writeFileSync(out, source
    .replace(/(\/\/ 3\n  \{ planet: 'mars', look: \d+, )map:/, '$1dark: true, map:')
    .replace(/(\/\/ 5\n  \{ planet: 'mars', look: \d+, )map:/, '$1storm: { from: 0, to: 0.5 }, map:'));
  execFileSync(process.execPath, [script, '--only', '3'], { stdio: 'pipe' });
  const after = (await readLevels()).levels;
  assert.equal(after[2].dark, true);
  assert.deepEqual(after[4].storm, { from: 0, to: 0.5 });
  assert.equal(after[0].dark, undefined);
  // The look seed stays with the level, regenerated or not, and counts the dropped levels.
  assert.deepEqual(after.map(l => l.look), after.map((_, i) => i + 1));
  execFileSync(process.execPath, [script, '--force'], { stdio: 'pipe' });
});

test('hand-made levels are locked: --only refuses them and --force refuses to run', () => {
  const before = fs.readFileSync(out, 'utf8');
  const only = spawnSync(process.execPath, [locked, '--only', '20'], { encoding: 'utf8' });
  assert.equal(only.status, 1);
  assert.match(only.stderr, /заперт/);
  const force = spawnSync(process.execPath, [locked, '--force'], { encoding: 'utf8' });
  assert.equal(force.status, 1);
  assert.match(force.stderr, /заперты/);
  assert.equal(fs.readFileSync(out, 'utf8'), before);
  const other = spawnSync(process.execPath, [locked, '--only', '4'], { encoding: 'utf8' });
  assert.equal(other.status, 0, other.stderr);
});

test('on the real levels.js, --only refuses the levels made by hand and leaves the file as it was', () => {
  const generated = fs.readFileSync(out, 'utf8');
  const real = fs.readFileSync(new URL('levels.js', ROOT), 'utf8');
  fs.writeFileSync(out, real);
  try {
    // 18 is Enceladus, seen from the side; 20 is the night level, in LOCKED.
    for (const number of ['18', '20']) {
      const run = spawnSync(process.execPath, [locked, '--only', number], { encoding: 'utf8' });
      assert.equal(run.status, 1, `--only ${number}`);
      assert.match(run.stderr, /сделан руками/);
      assert.equal(fs.readFileSync(out, 'utf8'), real);
    }
  } finally {
    fs.writeFileSync(out, generated);
  }
});

// The first of the 40 steps was dropped from the game, so the Moon has only two levels at the start.
test('generates 39 valid levels cycling the planets seen from above in blocks of 3', async () => {
  const { levels } = await readLevels();
  const above = PLANET_KEYS.filter(k => !PLANETS[k].side);
  assert.equal(levels.length, 39);
  levels.forEach((level, i) => {
    parseLevel(level, i + 1, PLANET_KEYS);
    assert.equal(level.planet, above[Math.floor((i + 1) / 3) % above.length], `level ${i + 1}`);
  });
  const { maze } = parseLevel(levels[1], 2, PLANET_KEYS);
  assert.deepEqual([maze.cols, maze.rows], [8, 5], 'level 2 has its own size (SIZE)');
});

test('routes get longer from the first levels to the last', async () => {
  const { levels } = await readLevels();
  const pathLength = i => {
    const { maze, start, goal } = parseLevel(levels[i], i + 1, PLANET_KEYS);
    return levelDistances(maze, start).get(`${goal.x},${goal.y}`).dist;
  };
  const avg = idx => idx.reduce((sum, i) => sum + pathLength(i), 0) / idx.length;
  assert.ok(avg([0, 1, 2, 3, 4]) <= 16);
  assert.ok(avg([34, 35, 36, 37, 38]) >= 50);
});

// LOCKED is all that keeps --only from regenerating a map made by hand: dark, storm and intro survive, I, M and T do not.
test('every level made by hand in levels.js (night, storm, meteor, ice) is in LOCKED', () => {
  const source = fs.readFileSync(new URL('tools/gen-levels.mjs', ROOT), 'utf8');
  const locked = JSON.parse(source.match(/const LOCKED = (\[[^\]]*\]);/)[1]);
  const byHand = LEVELS.map((level, i) => ({ n: i + 1, ...parseLevel(level, i + 1, PLANET_KEYS) }))
    // Levels seen from the side are never regenerated anyway, LOCKED or not.
    .filter(l => !PLANETS[l.planet].side && (l.dark || l.storm || l.meteors.length || l.ice.length)).map(l => l.n);
  assert.deepEqual(byHand.filter(n => !locked.includes(n)), []);
});

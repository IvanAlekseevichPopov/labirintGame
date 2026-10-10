import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stampVersion } from '../tools/stamp-version.mjs';

const stamp = source => stampVersion(source, 'abc123');

test('stamps static, multi-line and dynamic imports', () => {
  assert.equal(stamp(`import { a } from './a.js';`), `import { a } from './a.js?v=abc123';`);
  assert.equal(stamp(`import {\n  a,\n} from "../b.js";`), `import {\n  a,\n} from "../b.js?v=abc123";`);
  assert.equal(stamp(`await import('../levels.js')`), `await import('../levels.js?v=abc123')`);
  assert.equal(stamp(`<script src="js/main.js"></script>`), `<script src="js/main.js?v=abc123"></script>`);
});

test('leaves other strings alone', () => {
  const text = `'levels.js не загрузился' 'https://cdn.example/x.js' './style.css'`;
  assert.equal(stamp(text), text);
});

// Every module the game loads must get the version, or it could load twice under two URLs.
test('every relative module reference in the game is stamped', () => {
  const files = ['index.html', 'tools/sound-test.html', 'level-format.js', 'levels.js',
    ...fs.readdirSync(new URL('../js/', import.meta.url)).map(f => `js/${f}`)];
  for (const file of files) {
    const stamped = stamp(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    const unstamped = stamped.match(/['"](?:\.{1,2}\/|js\/)[^'"\s]*\.js['"]/g);
    assert.equal(unstamped, null, `${file}: ${unstamped}`);
  }
});

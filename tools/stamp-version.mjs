// Appends ?v=<version> to every relative .js module reference in the built site, so a browser
// never mixes cached old modules with new ones after a deploy. Every file must be stamped with
// the same version: a module imported under two URLs would load twice, with two separate states.
// Usage: node tools/stamp-version.mjs <site dir> <version>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A quoted relative path to a .js file: './x.js', '../x.js' or 'js/x.js'.
const MODULE_REF = /(['"])((?:\.{1,2}\/|js\/)[^'"\s]*?\.js)\1/g;

export function stampVersion(source, version) {
  return source.replace(MODULE_REF, (_, quote, ref) => `${quote}${ref}?v=${version}${quote}`);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(js|html)$/.test(entry.name)) yield full;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, version] = process.argv.slice(2);
  if (!dir || !version) {
    console.error('usage: node tools/stamp-version.mjs <site dir> <version>');
    process.exit(1);
  }
  for (const file of walk(dir)) fs.writeFileSync(file, stampVersion(fs.readFileSync(file, 'utf8'), version));
}

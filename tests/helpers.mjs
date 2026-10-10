import fs from 'node:fs';
import vm from 'node:vm';

export const ROOT = new URL('../', import.meta.url);
// Must match the keys of PLANETS in index.html.
export const PLANETS = ['moon', 'mars', 'europa'];

// The game's files are classic browser scripts sharing one global scope; load them the same way.
export function loadScripts(files, expose) {
  const source = files.map(f => fs.readFileSync(new URL(f, ROOT), 'utf8')).join('\n');
  return vm.runInContext(`${source}\n(${expose})`, vm.createContext({}));
}

// Objects created inside the vm context have that context's prototypes, which strict deep
// equality treats as different; compare plain copies instead.
export const plain = value => JSON.parse(JSON.stringify(value));

export const loadFormat = () =>
  loadScripts(['level-format.js'], '{ parseLevel, levelDistances, normalizeLevelLines }');

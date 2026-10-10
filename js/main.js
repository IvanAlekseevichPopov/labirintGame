// Entry point: loads and checks levels, runs the frame loop, keeps #level in the URL.

import { parseLevel } from '../level-format.js';
import { PLANET_KEYS } from './planets.js';
import * as game from './game.js';
import * as renderer from './render.js';
import { installKeyboard, pollGamepads } from './input.js';

let fatalError = null;

function fail(error) {
  console.error(error);
  fatalError = error.message;
}

// Imported dynamically so a syntax error from hand-editing levels.js shows on screen
// instead of silently stopping every module.
async function loadLevels() {
  let module;
  try {
    module = await import('../levels.js');
  } catch (error) {
    console.error(error);
    throw new Error('levels.js не загрузился или в нём ошибка (подробности в консоли)');
  }
  const { LEVELS } = module;
  if (!Array.isArray(LEVELS) || !LEVELS.length) throw new Error('в levels.js нет уровней');
  // A plain loop: forEach would silently skip a hole left by a stray comma.
  for (let i = 0; i < LEVELS.length; i++) parseLevel(LEVELS[i], i + 1, PLANET_KEYS);
  return LEVELS;
}

// #level=N or ?level=N (1-based) opens that level; the fragment wins, since the game keeps it current.
function levelIndexFromUrl() {
  const fromHash = location.hash.match(/^#level=(\d+)$/)?.[1];
  const n = Number(fromHash ?? new URLSearchParams(location.search).get('level'));
  return Number.isInteger(n) && n >= 1 ? n - 1 : 0;
}

// Keeps #level=N in the address bar so a page refresh continues from the same level.
function rememberLevelInUrl(index) {
  history.replaceState(null, '', `#level=${index + 1}`);
}

function handle(event) {
  if (event.type === 'levelStart') {
    renderer.levelChanged();
    rememberLevelInUrl(event.index);
  }
}

let lastFrameAt;
function frame(now) {
  requestAnimationFrame(frame);
  if (fatalError === null) {
    try {
      pollGamepads(now);
      for (const event of game.update(now, now - lastFrameAt, renderer.cellSize())) handle(event);
      renderer.render(now);
    } catch (error) {
      fail(error);
    }
  }
  if (fatalError !== null) renderer.drawError(fatalError);
  lastFrameAt = now;
}

renderer.resize();
addEventListener('resize', renderer.resize);
installKeyboard();

try {
  game.setLevels(await loadLevels());
  game.startLevel(levelIndexFromUrl(), performance.now());
  // Typing a new #level=N in the address bar does not reload the page.
  addEventListener('hashchange', () => {
    if (fatalError === null) game.startLevel(levelIndexFromUrl(), performance.now());
  });
} catch (error) {
  fail(error);
}
lastFrameAt = performance.now();
requestAnimationFrame(frame);

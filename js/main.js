// Entry point: loads and checks levels, switches scenes (title → playing, or error),
// routes input to the current scene, keeps #level in the URL.

import { parseLevel } from '../level-format.js';
import { PLANETS, PLANET_KEYS } from './planets.js';
import * as game from './game.js';
import * as renderer from './render.js';
import { installInput, pollGamepads } from './input.js';
import { createAudio } from './audio.js';

let scene = 'loading';
let fatalError = null;
let levels = [];
let titleIndex = 0;
// Sound may only start after a key press or click on the page; gamepad input does not count.
let gestureSeen = false;
const audio = createAudio();

const MUSIC_SETTING = 'labirint.music';
function loadMusicSetting() {
  try {
    return localStorage.getItem(MUSIC_SETTING) !== 'off';
  } catch {
    return true;
  }
}
function saveMusicSetting(on) {
  try {
    localStorage.setItem(MUSIC_SETTING, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the switch still works until the page is reloaded.
  }
}
let musicOn = loadMusicSetting();
audio.setMusicEnabled(musicOn);

function fail(error) {
  console.error(error);
  fatalError = error.message;
  scene = 'error';
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
  return Number.isInteger(n) && n >= 1 ? (n - 1) % levels.length : 0;
}

// Keeps #level=N in the address bar so a page refresh continues from the same level.
function rememberLevelInUrl(index) {
  history.replaceState(null, '', `#level=${index + 1}`);
}

function startPlaying(now) {
  audio.sfx('menu');
  game.startLevel(titleIndex, now);
  scene = 'playing';
}

function onInput(action) {
  const now = performance.now();
  if (action.type === 'gesture') {
    gestureSeen = true;
    audio.unlock();
  }
  if (action.type === 'toggleMusic') {
    musicOn = !musicOn;
    audio.setMusicEnabled(musicOn);
    saveMusicSetting(musicOn);
  }
  if (scene === 'title') {
    // On the start screen any button or d-pad press starts, so a kid with only the gamepad can too.
    if (action.type === 'confirm' || (action.type === 'dir' && action.down)) startPlaying(now);
  } else if (scene === 'playing') {
    if (action.type === 'dir') {
      if (action.down) game.press(action.dir, action.source, now);
      else game.release(action.dir, action.source);
    } else if (action.type === 'restart') {
      game.restartLevel(now);
    } else if (action.type === 'blur') {
      game.forgetSource('key');
    }
  }
}

// Game events drive the picture and the sound.
function handle(event) {
  const planet = PLANETS[game.state.planet];
  switch (event.type) {
    case 'levelStart':
      renderer.levelChanged();
      rememberLevelInUrl(event.index);
      audio.setEngine(null);
      audio.playMusic(game.state.planet);
      audio.sfx(event.restart ? 'restart' : 'levelStart');
      break;
    case 'move':
      audio.setEngine(planet.rover);
      break;
    case 'stop':
      audio.setEngine(null);
      break;
    case 'bump':
    case 'ignite':
      audio.sfx(event.type);
      break;
    case 'landmark':
      // Only things people left there feel like a checkpoint; a crater or ice hole is just ground.
      if (event.kind !== 'crater') audio.sfx('landmark');
      break;
    case 'arrive':
      audio.setEngine(null);
      audio.sfx('arrive');
      break;
    case 'liftoff':
      audio.sfx('liftoff');
      audio.sfx('cheer');
      break;
  }
}

let lastFrameAt;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    pollGamepads(onInput);
    if (scene === 'title') {
      renderer.renderTitle(now, { planet: levels[titleIndex].planet, levelNumber: titleIndex + 1 });
    } else if (scene === 'playing') {
      for (const event of game.update(now, now - lastFrameAt, renderer.cellSize())) handle(event);
      renderer.render(now, { soundOff: !gestureSeen });
    }
  } catch (error) {
    fail(error);
  }
  if (scene === 'error') renderer.drawError(fatalError);
  lastFrameAt = now;
}

renderer.resize();
addEventListener('resize', renderer.resize);
installInput(action => {
  try {
    onInput(action);
  } catch (error) {
    fail(error);
  }
});

try {
  levels = await loadLevels();
  game.setLevels(levels);
  titleIndex = levelIndexFromUrl();
  scene = 'title';
  // Starts once a key press unlocks sound: the title plays the tune of the planet ahead.
  audio.playMusic(levels[titleIndex].planet);
  // Typing a new #level=N in the address bar does not reload the page.
  addEventListener('hashchange', () => {
    titleIndex = levelIndexFromUrl();
    if (scene === 'playing') game.startLevel(titleIndex, performance.now());
  });
} catch (error) {
  fail(error);
}
lastFrameAt = performance.now();
requestAnimationFrame(frame);

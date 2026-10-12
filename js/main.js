// Entry point: loads and checks levels, switches scenes (title → playing ⇄ paused → finale, or error),
// routes input to the current scene, keeps #level in the URL.

import { parseLevel } from '../level-format.js';
import { PLANETS, PLANET_KEYS } from './planets.js';
import { LANDMARKS } from './landmarks.js';
import * as game from './game.js';
import * as renderer from './render.js';
import { installInput, pollGamepads } from './input.js';
import { createAudio } from './audio.js';
import { FONT } from './art.js';

let scene = 'loading';
let fatalError = null;
let levels = [];
let titleIndex = 0;
// Sound may only start after a key press or click on the page; gamepad input does not count.
let gestureSeen = false;
const audio = createAudio();

function loadSwitch(key) {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}
function saveSwitch(key, on) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the switch still works until the page is reloaded.
  }
}
// All sound settings live in the pause menu; there are no hidden keys for them.
let soundOn = loadSwitch('labirint.sound');
audio.setMuted(!soundOn);

// Game time stops while paused, so a step, the win sequence and animations resume where they left off.
let pausedTotal = 0;
let pausedAt = null;
const gameTime = real => (pausedAt ?? real) - pausedTotal;

const PAUSE_ITEMS = ['resume', 'restart', 'sound'];
let pauseSelected = 0;
const pauseLabels = () => ['Продолжить', 'Начать уровень заново', soundOn ? 'Звук: вкл' : 'Звук: выкл'];

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
  game.startLevel(titleIndex, gameTime(now));
  scene = 'playing';
}

function openPause(now) {
  scene = 'paused';
  audio.cutSweeps();
  pausedAt = now;
  // The cursor starts on "continue", so a double press cannot restart by accident.
  pauseSelected = 0;
  // Directions held when pausing must be pressed again after it, not drive on by themselves.
  game.forgetSource('key');
  game.forgetSource('pad');
  audio.setEngine(null);
  audio.duckMusic();
}

function closePause(now) {
  pausedTotal += now - pausedAt;
  pausedAt = null;
  scene = 'playing';
  audio.unduckMusic();
}

function choosePauseItem(now) {
  audio.sfx('menu');
  const item = PAUSE_ITEMS[pauseSelected];
  if (item === 'resume') {
    closePause(now);
  } else if (item === 'restart') {
    closePause(now);
    game.restartLevel(gameTime(now));
  } else if (item === 'sound') {
    soundOn = !soundOn;
    audio.setMuted(!soundOn);
    saveSwitch('labirint.sound', soundOn);
  }
}

function onInput(action) {
  const now = performance.now();
  if (action.type === 'gesture') {
    gestureSeen = true;
    audio.unlock();
  }
  const anyButton = ['confirm', 'pause', 'select'].includes(action.type);
  if (scene === 'title') {
    // On the start screen any button or d-pad press starts, so a kid with only the gamepad can too.
    if (anyButton || (action.type === 'dir' && action.down)) startPlaying(now);
  } else if (scene === 'playing') {
    if (action.type === 'dir') {
      if (action.down) game.press(action.dir, action.source, gameTime(now));
      else game.release(action.dir, action.source);
    } else if (action.type === 'pause') {
      openPause(now);
    } else if (action.type === 'blur') {
      game.forgetSource('key');
    }
  } else if (scene === 'paused') {
    if (action.type === 'pause') {
      closePause(now);
    } else if (action.type === 'confirm') {
      choosePauseItem(now);
    } else if (action.type === 'dir' && action.down && (action.dir === 'up' || action.dir === 'down')) {
      const step = action.dir === 'up' ? -1 : 1;
      pauseSelected = (pauseSelected + step + PAUSE_ITEMS.length) % PAUSE_ITEMS.length;
    }
  } else if (scene === 'finale') {
    if (anyButton) {
      titleIndex = 0;
      startPlaying(now);
    }
  }
}

// Night and storm levels have their own tunes.
const songFor = ({ planet, dark, storm }) => (dark ? 'moonNight' : storm ? 'marsStorm' : planet);

// Game events drive the picture and the sound.
function handle(event) {
  const planet = PLANETS[game.state.planet];
  switch (event.type) {
    case 'levelStart':
      renderer.levelChanged(levels.length);
      rememberLevelInUrl(event.index);
      audio.setEngine(null);
      audio.playMusic(songFor(game.state));
      if (event.restart) audio.cutSweeps();
      audio.sfx(event.restart ? 'restart' : 'levelStart');
      break;
    case 'lightsOn':
    case 'lightsOff':
    case 'meteorWarn':
      audio.sfx(event.type);
      break;
    case 'meteorImpact':
      renderer.mazeChanged();
      audio.sfx(event.type);
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
      if (LANDMARKS[event.kind].chime) audio.sfx('landmark');
      break;
    case 'arrive':
      audio.setEngine(null);
      audio.sfx('arrive');
      break;
    case 'liftoff':
      audio.sfx('liftoff');
      audio.sfx('cheer');
      break;
    case 'finished':
      scene = 'finale';
      audio.playMusic('moon');
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
      for (const event of game.update(gameTime(now), now - lastFrameAt, renderer.cellSize())) handle(event);
      renderer.render(gameTime(now), { soundOff: !gestureSeen || !soundOn });
    } else if (scene === 'paused') {
      renderer.render(gameTime(now));
      renderer.renderPause(now, { items: pauseLabels(), selected: pauseSelected });
    } else if (scene === 'finale') {
      renderer.renderFinale(now);
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
    if (scene === 'playing') game.startLevel(titleIndex, gameTime(performance.now()));
  });
} catch (error) {
  fail(error);
}
// Canvas text does not wait for a web font: load it first, or the title shows in the system font
// for a moment. It is bundled, so this is quick; on a slow start, go on after a second anyway.
await Promise.race([document.fonts.load(`40px ${FONT}`, 'Космический лабиринт'), new Promise(resolve => setTimeout(resolve, 1000))])
  .catch(() => {});
lastFrameAt = performance.now();
requestAnimationFrame(frame);

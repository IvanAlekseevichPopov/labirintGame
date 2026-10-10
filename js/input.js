// Keyboard and gamepad, translated into game.press/release.

import * as game from './game.js';
import {
  KEY_TO_DIR, PAD_PRESS, PAD_RELEASE, PAD_RESTART_BUTTON, PAD_STANDARD_DPAD, RESTART_KEYS,
} from './config.js';

export function installKeyboard() {
  addEventListener('keydown', e => {
    if (RESTART_KEYS.includes(e.key)) {
      if (!e.repeat) game.restartLevel(performance.now());
      return;
    }
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    if (!e.repeat) game.press(dir, 'key', performance.now());
  });
  addEventListener('keyup', e => {
    if (KEY_TO_DIR[e.key]) game.release(KEY_TO_DIR[e.key], 'key');
  });
  // Key-ups that happen while the window is unfocused never arrive.
  addEventListener('blur', () => game.forgetSource('key'));
}

const pad = { restart: false };

function readPadDirs(gp) {
  const dirs = new Set();
  // Hysteresis keeps a jittery axis near the threshold from re-pressing every frame.
  const on = (dir, v) => v >= (game.input.bySource.pad.has(dir) ? PAD_RELEASE : PAD_PRESS);
  const [x = 0, y = 0] = gp.axes;
  if (on('left', -x)) dirs.add('left');
  if (on('right', x)) dirs.add('right');
  if (on('up', -y)) dirs.add('up');
  if (on('down', y)) dirs.add('down');
  if (gp.mapping === 'standard') {
    for (const [i, dir] of Object.entries(PAD_STANDARD_DPAD)) if (gp.buttons[i]?.pressed) dirs.add(dir);
  }
  return dirs;
}

// Gamepads have no events for buttons or axes, so they are polled once per frame.
export function pollGamepads(now) {
  const dirs = new Set();
  let restart = false;
  for (const gp of navigator.getGamepads?.() ?? []) {
    if (!gp) continue;
    for (const dir of readPadDirs(gp)) dirs.add(dir);
    if (gp.buttons[PAD_RESTART_BUTTON]?.pressed) restart = true;
  }
  const held = game.input.bySource.pad;
  for (const dir of [...held]) if (!dirs.has(dir)) game.release(dir, 'pad');
  for (const dir of dirs) if (!held.has(dir)) game.press(dir, 'pad', now);
  if (restart && !pad.restart) game.restartLevel(now);
  pad.restart = restart;
}

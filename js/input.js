// Keyboard, mouse and gamepad, turned into actions for main.js to route to the current scene:
//   { type: 'dir', dir, down, source }   a direction pressed or released
//   { type: 'confirm' }                   start / OK
//   { type: 'pause' }                     Start on the gamepad, Esc
//   { type: 'select' }                    Select on the gamepad
//   { type: 'gesture' }                   a key or click: the browser now allows sound
//   { type: 'blur' }                      the window lost focus, key-ups will not arrive

import {
  CONFIRM_KEYS, KEY_TO_DIR, PAD_PRESS, PAD_RELEASE, PAD_SELECT_BUTTON, PAD_STANDARD_DPAD, PAD_START_BUTTON,
  PAUSE_KEYS,
} from './config.js';

export function installInput(handle) {
  addEventListener('keydown', e => {
    handle({ type: 'gesture' });
    const dir = KEY_TO_DIR[e.key];
    if (dir || CONFIRM_KEYS.includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (dir) handle({ type: 'dir', dir, down: true, source: 'key' });
    else if (CONFIRM_KEYS.includes(e.key)) handle({ type: 'confirm' });
    else if (PAUSE_KEYS.includes(e.key)) handle({ type: 'pause' });
  });
  addEventListener('keyup', e => {
    const dir = KEY_TO_DIR[e.key];
    if (dir) handle({ type: 'dir', dir, down: false, source: 'key' });
  });
  addEventListener('pointerdown', () => {
    handle({ type: 'gesture' });
    handle({ type: 'confirm' });
  });
  addEventListener('blur', () => handle({ type: 'blur' }));
}

// Gamepads have no events for buttons or axes, so they are polled once per frame and
// reported on change. Pad presses do not count as a gesture: Chrome does not unlock sound for them.
const pad = { dirs: new Set(), buttons: new Set() };

function readPadDirs(gp) {
  const dirs = new Set();
  // Hysteresis keeps a jittery axis near the threshold from re-pressing every frame.
  const on = (dir, v) => v >= (pad.dirs.has(dir) ? PAD_RELEASE : PAD_PRESS);
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

export function pollGamepads(handle) {
  const dirs = new Set();
  const buttons = new Set();
  for (const gp of navigator.getGamepads?.() ?? []) {
    if (!gp) continue;
    for (const dir of readPadDirs(gp)) dirs.add(dir);
    gp.buttons.forEach((b, i) => {
      if (b.pressed && !(gp.mapping === 'standard' && i in PAD_STANDARD_DPAD)) buttons.add(i);
    });
  }
  for (const dir of pad.dirs) if (!dirs.has(dir)) handle({ type: 'dir', dir, down: false, source: 'pad' });
  for (const dir of dirs) if (!pad.dirs.has(dir)) handle({ type: 'dir', dir, down: true, source: 'pad' });
  for (const i of buttons) {
    if (pad.buttons.has(i)) continue;
    const type = i === PAD_START_BUTTON ? 'pause' : i === PAD_SELECT_BUTTON ? 'select' : 'confirm';
    handle({ type });
  }
  pad.dirs = dirs;
  pad.buttons = buttons;
}

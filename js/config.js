// Holding a direction: first step at once, next after FIRST_REPEAT_MS, then every step interval.
export const FIRST_REPEAT_MS = 300;
// Step interval scales with cell size so on-screen speed stays similar across levels.
export const MIN_STEP_MS = 150;
export const MAX_STEP_MS = 220;
export const TURN_BUFFER_MS = 500;
export const INPUT_LOCK_MS = 400;
export const BUMP_MS = 140;
export const WALL_RATIO = 0.26;
export const ROVER_RATIO = 0.78;

// Timeline of the win sequence, ms since reaching the rocket.
export const WIN = { shrinkStart: 150, shrinkMs: 400, ignite: 600, lift: 1000, liftMs: 1400, next: 2600 };

export const DIRS = {
  up:    { dx: 0,  dy: -1, wall: 'top',    angle: -Math.PI / 2 },
  down:  { dx: 0,  dy: 1,  wall: 'bottom', angle: Math.PI / 2 },
  left:  { dx: -1, dy: 0,  wall: 'left',   angle: Math.PI },
  right: { dx: 1,  dy: 0,  wall: 'right',  angle: 0 },
};

export const KEY_TO_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
export const RESTART_KEYS = ['r', 'R', 'к', 'К'];
export const CONFIRM_KEYS = ['Enter', ' '];
export const PAUSE_KEYS = ['Escape'];
// The parent's switch for the music only; deliberately not on the gamepad.
export const MUSIC_KEYS = ['m', 'M', 'ь', 'Ь'];
// Cheap pads (mapping "") report the d-pad as axes 0/1; standard-mapped pads as buttons 12–15.
export const PAD_PRESS = 0.5;
export const PAD_RELEASE = 0.3;
export const PAD_STANDARD_DPAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
// Select does nothing in play: a kid would hit it by accident. Restart lives in the pause menu.
export const PAD_SELECT_BUTTON = 8;
export const PAD_START_BUTTON = 9;

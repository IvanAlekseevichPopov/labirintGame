// Holding a direction: first step at once, next after FIRST_REPEAT_MS, then every step interval.
export const FIRST_REPEAT_MS = 300;
// Step interval scales with cell size so on-screen speed stays similar across levels.
export const MIN_STEP_MS = 150;
export const MAX_STEP_MS = 220;
export const TURN_BUFFER_MS = 500;
export const INPUT_LOCK_MS = 400;
// On a dark level the headlights come on this long after the level starts, then flicker for
// LIGHTS_FLICKER_MS before they hold; the rover cannot move until they do.
export const LIGHTS_ON_MS = 500;
// At night under water the drone pings its sonar by itself: the first ping this long after the
// lights come on, then one every SONAR_EVERY_MS (render.js and deep.js draw it).
export const SONAR_FIRST_MS = 1500;
export const SONAR_EVERY_MS = 6000;
export const LIGHTS_FLICKER_MS = 300;
// Back into the storm sooner than this after leaving it and the lights just stay on: no new flicker or click.
export const LIGHTS_REARM_MS = 1000;
// A meteor: its shadow grows on the target cell for METEOR_WARN_MS, then it hits and the ground
// shakes for METEOR_SHAKE_MS. If the rover happens to be on the cell, the hit waits a little.
// A level with M but no T sets its meteor off startMs after the level begins.
export const METEOR = { warnMs: 900, shakeMs: 350, retryMs: 150, startMs: 1200 };
export const BUMP_MS = 140;
// Holding the way into an ice wall this long drills through it; letting go keeps the progress.
export const DRILL_MS = 1500;
// The drill intro (`intro: 'drill'`): the black bars slide in over barsMs, the rover waits leadMs from
// the level start, drills, drives one cell and holdMs later the player takes over.
export const INTRO = { barsMs: 450, leadMs: 900, holdMs: 350 };
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
export const CONFIRM_KEYS = ['Enter', ' '];
export const PAUSE_KEYS = ['Escape'];
// Cheap pads (mapping "") report the d-pad as an axis pair: 0/1 in Chrome, 3/4 in Firefox
// (Twin USB Joystick on macOS). Standard-mapped pads report it as buttons 12–15.
export const PAD_DPAD_AXES = [[0, 1], [3, 4]];
export const PAD_PRESS = 0.5;
export const PAD_RELEASE = 0.3;
export const PAD_STANDARD_DPAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
// Select does nothing in play: a kid would hit it by accident. Restart lives in the pause menu.
export const PAD_SELECT_BUTTON = 8;
export const PAD_START_BUTTON = 9;

// Levels removed from the start of the game after play. Level looks and the generator's mazes are
// seeded by the old numbers, so the levels that stayed look the same as before.
export const DROPPED_LEVELS = 1;

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../js/game.js';
import { FIRST_REPEAT_MS, INPUT_LOCK_MS, MAX_STEP_MS, TURN_BUFFER_MS, WIN } from '../js/config.js';

const { state, input } = game;

// Corridor from S to the right; at x=2 a dead end goes up, at x=4 it turns down and right to R.
const CORRIDOR = {
  planet: 'moon',
  map: `
#############
# # # # # # #
##### #######
#S        # #
######### ###
# # # # #  R#
#############
`,
};
const CELL_PX = 100;
const STEP_MS = 165; // what CELL_PX gives: 120 + 100 * 0.45
const FRAME_MS = 16;

let now;
// Advances in small frames so the game sees time pass the way it does in a browser.
function run(ms) {
  const events = [];
  for (const end = now + ms; now < end;) {
    now = Math.min(end, now + FRAME_MS);
    events.push(...game.update(now, FRAME_MS, CELL_PX));
  }
  return events;
}
const tap = (dir, source = 'key') => {
  game.press(dir, source, now);
  run(FRAME_MS);
  game.release(dir, source);
};
const driveToRocket = () => {
  game.press('right', 'key', now);
  run(FIRST_REPEAT_MS + 3 * STEP_MS + FRAME_MS);
  game.release('right', 'key');
  tap('down');
  run(STEP_MS);
  tap('right');
};

beforeEach(() => {
  now = 1000;
  for (const source of ['key', 'pad']) game.forgetSource(source);
  game.setLevels([CORRIDOR, { ...CORRIDOR, planet: 'mars' }]);
  game.startLevel(0, now);
  // Also drains the levelStart event, and any a previous test left behind.
  run(INPUT_LOCK_MS);
});

test('a level starts at S facing along the route and reports levelStart', () => {
  game.startLevel(1, now);
  assert.deepEqual(state.player, { x: 0, y: 1 });
  assert.equal(state.angle, 0);
  assert.equal(state.planet, 'mars');
  assert.deepEqual(run(16), [{ type: 'levelStart', index: 1 }]);
});

test('input is ignored right after a level starts', () => {
  game.startLevel(0, now);
  game.press('right', 'key', now);
  run(INPUT_LOCK_MS / 2);
  assert.deepEqual(state.player, { x: 0, y: 1 });
});

test('a short tap moves exactly one cell', () => {
  tap('right');
  run(500);
  assert.deepEqual(state.player, { x: 1, y: 1 });
});

test('holding repeats after FIRST_REPEAT_MS, then every step', () => {
  game.press('right', 'key', now);
  run(FRAME_MS);
  assert.equal(state.player.x, 1);
  run(FIRST_REPEAT_MS - 2 * FRAME_MS);
  assert.equal(state.player.x, 1, 'no repeat before the delay');
  run(2 * FRAME_MS);
  assert.equal(state.player.x, 2, 'first repeat');
  run(STEP_MS - 2 * FRAME_MS);
  assert.equal(state.player.x, 2, 'next step not before the step interval');
  run(2 * FRAME_MS);
  assert.equal(state.player.x, 3);
});

test('a tap released before the next frame still moves', () => {
  game.press('right', 'key', now);
  game.release('right', 'key');
  run(FRAME_MS);
  assert.equal(state.player.x, 1);
});

test('a new press waits for the current step to finish', () => {
  tap('right');
  tap('left');
  assert.equal(state.player.x, 1, 'not reversed mid-step');
  run(STEP_MS);
  assert.equal(state.player.x, 0);
});

test('the most recently pressed open direction wins', () => {
  run(MAX_STEP_MS);
  game.press('right', 'key', now);
  run(FRAME_MS);
  run(FIRST_REPEAT_MS + 3 * STEP_MS);
  game.press('left', 'key', now);
  const at = state.player.x;
  run(STEP_MS + FRAME_MS);
  assert.equal(state.player.x, at - 1);
});

test('an early turn is forgotten after TURN_BUFFER_MS', () => {
  tap('right');
  run(STEP_MS);
  tap('up');
  run(TURN_BUFFER_MS + FRAME_MS);
  game.press('right', 'key', now);
  run(FIRST_REPEAT_MS + STEP_MS);
  assert.deepEqual(state.player, { x: 3, y: 1 }, 'drove past the dead end at x=2');
});

test('a turn pressed early is taken when the corridor opens', () => {
  game.press('right', 'key', now);
  run(16);
  game.press('up', 'key', now);
  run(FIRST_REPEAT_MS + 2 * STEP_MS + FRAME_MS);
  assert.deepEqual(state.player, { x: 2, y: 0 }, 'kept going right, then turned up at x=2');
});

test('hitting a wall bumps once, without moving', () => {
  game.press('up', 'key', now);
  run(600);
  assert.deepEqual(state.player, { x: 0, y: 1 });
  assert.equal(state.bump.dir, 'up');
  const firstBump = state.bump.at;
  run(600);
  assert.equal(state.bump.at, firstBump);
});

test('a key still held when its device is forgotten does not drive until pressed again', () => {
  game.press('right', 'key', now);
  game.forgetSource('key');
  run(500);
  assert.equal(state.player.x, 0);
  game.press('right', 'key', now);
  run(FRAME_MS);
  assert.equal(state.player.x, 1);
});

test('releasing a direction on one device keeps it held on the other', () => {
  game.press('right', 'pad', now);
  tap('right', 'key');
  assert.ok(input.held.includes('right'));
  game.release('right', 'pad');
  assert.ok(!input.held.includes('right'));
});

test('tracks are recorded once per corridor segment, after the rover leaves it', () => {
  tap('right');
  assert.equal(state.tracks.length, 0, 'not ahead of the rover');
  run(STEP_MS);
  assert.equal(state.tracks.length, 1);
  tap('left');
  run(STEP_MS);
  assert.equal(state.tracks.length, 1, 'driving back does not double it');
});

test('restart puts the rover back, clears tracks and reports levelStart', () => {
  tap('right');
  run(STEP_MS);
  game.restartLevel(now);
  assert.deepEqual(state.player, { x: 0, y: 1 });
  assert.equal(state.tracks.length, 0);
  assert.deepEqual(run(FRAME_MS), [{ type: 'levelStart', index: 0 }]);
});

test('reaching the rocket wins, blocks input and starts the next level', () => {
  driveToRocket();
  assert.deepEqual(state.player, { x: 5, y: 2 });
  assert.ok(state.wonAt > now, 'the win starts once the rover has arrived, not when it sets off');
  run(STEP_MS);

  game.restartLevel(now);
  assert.equal(state.index, 0, 'restart is ignored during the win animation');
  const events = run(WIN.next + STEP_MS);
  assert.deepEqual(events, [{ type: 'levelStart', index: 1 }]);
  assert.equal(input.held.length, 0, 'a key held through the win does not drive the new level');
});

test('levels wrap around after the last one', () => {
  game.startLevel(2, now);
  assert.equal(state.index, 0);
  run(FRAME_MS);
});

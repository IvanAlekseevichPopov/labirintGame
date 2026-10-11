import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../js/game.js';
import { levelDistances } from '../level-format.js';
import { FIRST_REPEAT_MS, INPUT_LOCK_MS, LIGHTS_FLICKER_MS, LIGHTS_ON_MS, LIGHTS_REARM_MS, MAX_STEP_MS, METEOR, TURN_BUFFER_MS, WIN } from '../js/config.js';

const { state, input } = game;

// Corridor from S to the right; at x=2 a dead end with a flag goes up, at x=4 it turns down and right to R.
const CORRIDOR = {
  planet: 'moon',
  map: `
#############
# # #F# # # #
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
  assert.deepEqual(run(16), [{ type: 'levelStart', index: 1, restart: false }]);
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
  assert.deepEqual(run(FRAME_MS), [{ type: 'levelStart', index: 0, restart: true }]);
});

test('reaching the rocket wins, blocks input and starts the next level', () => {
  driveToRocket();
  assert.deepEqual(state.player, { x: 5, y: 2 });
  assert.ok(state.wonAt > now, 'the win starts once the rover has arrived, not when it sets off');
  run(STEP_MS);

  game.restartLevel(now);
  assert.equal(state.index, 0, 'restart is ignored during the win animation');
  const events = run(WIN.next + STEP_MS);
  assert.deepEqual(events.at(-1), { type: 'levelStart', index: 1, restart: false });
  assert.equal(input.held.length, 0, 'a key held through the win does not drive the new level');
});

const types = events => events.map(e => e.type);

test('the drive to the rocket is reported as events, win phases in order', () => {
  game.press('right', 'key', now);
  const events = run(FIRST_REPEAT_MS + 3 * STEP_MS + FRAME_MS);
  game.release('right', 'key');
  game.press('down', 'key', now);
  events.push(...run(FRAME_MS));
  game.release('down', 'key');
  events.push(...run(STEP_MS));
  game.press('right', 'key', now);
  events.push(...run(FRAME_MS));
  game.release('right', 'key');
  events.push(...run(STEP_MS + WIN.next + FRAME_MS));

  const seen = types(events);
  assert.equal(seen.filter(t => t === 'move').length, 6);
  assert.equal(seen.filter(t => t === 'bump').length, 0, 'the last right step was not into a wall');
  const order = ['arrive', 'ignite', 'liftoff', 'levelStart'].map(t => seen.indexOf(t));
  assert.ok(order.every((i, k) => i > (order[k - 1] ?? seen.lastIndexOf('move'))), seen.join(' '));
  assert.equal(state.phase, 'playing', 'the next level starts in play');
});

test('holding a direction keeps the engine running through the key-repeat pause', () => {
  game.press('right', 'key', now);
  const events = run(FIRST_REPEAT_MS + 2 * STEP_MS + FRAME_MS);
  assert.deepEqual(types(events), ['move', 'move', 'move']);
  game.release('right', 'key');
  assert.deepEqual(types(run(STEP_MS)), ['stop']);
});

test('driving into a wall bumps and stops the engine', () => {
  game.press('right', 'key', now);
  const events = run(FIRST_REPEAT_MS + 4 * STEP_MS + FRAME_MS);
  assert.deepEqual(types(events), ['move', 'move', 'move', 'move', 'bump', 'stop']);
  assert.deepEqual(events[4], { type: 'bump', dir: 'right' });
});

test('driving onto a landmark reports it', () => {
  tap('right');
  run(STEP_MS);
  tap('right');
  run(STEP_MS);
  game.press('up', 'key', now);
  const events = run(FRAME_MS);
  assert.deepEqual(events.slice(0, 2), [{ type: 'move', dir: 'up' }, { type: 'landmark', kind: 'flag' }]);
});

test('winning the last level finishes the game instead of starting another', () => {
  game.startLevel(1, now);
  run(INPUT_LOCK_MS);
  driveToRocket();
  const events = run(STEP_MS + WIN.next + FRAME_MS);
  assert.equal(events.at(-1).type, 'finished');
  assert.ok(!types(events).includes('levelStart'));
  assert.equal(state.phase, 'finished');
  assert.deepEqual(run(1000), [], 'nothing happens after the finish');
});

test('levels wrap around after the last one', () => {
  game.startLevel(2, now);
  assert.equal(state.index, 0);
  run(FRAME_MS);
});

test('a dark level switches the headlights on after a moment and only then takes input', () => {
  game.setLevels([{ ...CORRIDOR, dark: true }, CORRIDOR]);
  game.startLevel(0, now);
  assert.equal(state.dark, true);
  const early = run(LIGHTS_ON_MS - FRAME_MS);
  assert.ok(!early.some(e => e.type === 'lightsOn'));
  const [on] = run(FRAME_MS * 2).filter(e => e.type === 'lightsOn');
  assert.ok(on);
  tap('right');
  run(FRAME_MS);
  assert.equal(state.player.x, 0, 'still parked while the lights flicker');
  run(LIGHTS_FLICKER_MS);
  tap('right');
  run(STEP_MS);
  assert.equal(state.player.x, 1);
});

test('a plain level never reports lightsOn', () => {
  const events = run(LIGHTS_ON_MS * 2);
  assert.ok(!events.some(e => e.type === 'lightsOn'));
});

// The corridor's right half is in the storm: cells x ≥ 3 of 6.
const STORMY = { ...CORRIDOR, storm: { from: 0.5, to: 1 } };
const lightEvents = events => events.filter(e => e.type.startsWith("lights")).map(e => e.type);
const drive = (dir, steps) => {
  game.press(dir, 'key', now);
  const events = run(FIRST_REPEAT_MS + (steps - 1) * STEP_MS + FRAME_MS);
  game.release(dir, 'key');
  return events;
};

test('entering a storm switches the headlights on, leaving it switches them off after the step', () => {
  game.setLevels([STORMY, CORRIDOR]);
  game.startLevel(0, now);
  run(INPUT_LOCK_MS);
  assert.equal(state.lightsOn, false, 'starts outside the storm, lights off');
  assert.deepEqual(lightEvents(drive('right', 4)), ['lightsOn']);
  assert.equal(state.player.x, 4);
  run(LIGHTS_FLICKER_MS);
  assert.equal(state.lightsOn, true);
  game.press('left', 'key', now);
  const leaving = run(FIRST_REPEAT_MS + STEP_MS + FRAME_MS);
  assert.equal(state.player.x, 2);
  assert.equal(state.lightsOn, true, 'still lit while the step out is under way');
  const settled = run(STEP_MS + FRAME_MS);
  game.release('left', 'key');
  assert.deepEqual(lightEvents([...leaving, ...settled]), ['lightsOff']);
  assert.equal(state.lightsOn, false);
});

test('straight back into the storm keeps the lights on without a new flicker or click', () => {
  game.setLevels([STORMY, CORRIDOR]);
  game.startLevel(0, now);
  run(INPUT_LOCK_MS);
  drive('right', 3);
  run(LIGHTS_FLICKER_MS);
  const out = drive('left', 1);
  run(STEP_MS * 2);
  assert.ok(lightEvents(out).includes('lightsOff') || state.lightsOn === false);
  const back = [...drive('right', 1), ...run(STEP_MS)];
  assert.deepEqual(lightEvents(back), []);
  assert.equal(state.lightsOn, true);
  assert.ok(now - state.lightsAt >= LIGHTS_FLICKER_MS, 'no flicker: lights count as long on');
  drive('left', 1);
  run(STEP_MS * 2 + LIGHTS_REARM_MS);
  const later = [...drive('right', 1), ...run(STEP_MS)];
  assert.deepEqual(lightEvents(later), ['lightsOn'], 'after a while the switch-on is real again');
});

test('a level that starts inside a storm waits for the lights like a dark one', () => {
  game.setLevels([{ ...CORRIDOR, storm: { from: 0, to: 0.5 } }, CORRIDOR]);
  game.startLevel(0, now);
  const early = run(LIGHTS_ON_MS - FRAME_MS);
  assert.deepEqual(lightEvents(early), []);
  assert.deepEqual(lightEvents(run(FRAME_MS * 2)), ['lightsOn']);
  tap('right');
  run(FRAME_MS);
  assert.equal(state.player.x, 0, 'parked while the lights flicker');
  run(LIGHTS_FLICKER_MS);
  tap('right');
  run(STEP_MS);
  assert.equal(state.player.x, 1);
});

test('restarting from inside the storm puts the lights out quietly', () => {
  game.setLevels([STORMY, CORRIDOR]);
  game.startLevel(0, now);
  run(INPUT_LOCK_MS);
  drive('right', 4);
  run(LIGHTS_FLICKER_MS);
  assert.equal(state.lightsOn, true);
  game.restartLevel(now);
  const events = run(INPUT_LOCK_MS);
  assert.equal(state.lightsOn, false);
  assert.deepEqual(lightEvents(events), []);
});

// A loop: top corridor S → T → M → R, bottom corridor back round. Driving onto T sets the meteor off.
const LOOP = {
  planet: 'moon',
  map: `
#################
#S   T     M   R#
# ############# #
#               #
#################
`,
};
const meteorEvents = events => events.filter(e => e.type.startsWith('meteor')).map(e => e.type);

test('driving onto T starts the meteor, which lands after METEOR.warnMs and walls M off', () => {
  game.setLevels([LOOP, LOOP]);
  game.startLevel(0, now);
  run(INPUT_LOCK_MS);
  assert.equal(state.meteor.phase, 'waiting');
  const warn = drive('right', 2);
  assert.equal(state.player.x, 2);
  assert.deepEqual(meteorEvents(warn), ['meteorWarn']);
  assert.equal(state.meteor.phase, 'falling');
  const quiet = run(state.meteor.at - now - FRAME_MS * 2);
  assert.deepEqual(meteorEvents(quiet), []);
  const hit = run(FRAME_MS * 4);
  assert.deepEqual(meteorEvents(hit), ['meteorImpact']);
  assert.equal(state.meteor.phase, 'fallen');
  assert.ok(state.maze.cells[0][5].left && state.maze.cells[0][4].right, 'M is walled off');
  assert.ok(state.landmarks.some(l => l.type === 'impact' && l.x === 5 && l.y === 0));
  drive('right', 2);
  assert.equal(state.player.x, 4);
  const bump = [...drive('right', 1), ...run(STEP_MS)];
  assert.equal(state.player.x, 4, 'cannot drive into the crater');
  assert.ok(bump.some(e => e.type === 'bump'));
  assert.ok(levelDistances(state.maze, state.player).has('7,0'), 'the other way round is still open');
});

test('the meteor waits while the rover is on its cell, and a restart resets it', () => {
  game.setLevels([LOOP, LOOP]);
  game.startLevel(0, now);
  run(INPUT_LOCK_MS);
  drive('right', 5);
  assert.equal(state.player.x, 5, 'on M');
  const due = state.meteor.at;
  const held = run(METEOR.warnMs + METEOR.retryMs * 3);
  assert.deepEqual(meteorEvents(held), [], 'no hit under the rover');
  assert.equal(state.meteor.phase, 'falling');
  assert.equal(state.meteor.at, due, 'the picture does not jump while it waits');
  tap('right');
  const hit = run(STEP_MS + METEOR.retryMs + FRAME_MS * 2);
  assert.equal(state.player.x, 6);
  assert.deepEqual(meteorEvents(hit), ['meteorImpact'], 'lands once the rover has moved off');
  assert.ok(state.meteor.at > due && state.meteor.at <= now, 'the impact time is when it really hit');
  game.restartLevel(now);
  run(INPUT_LOCK_MS);
  assert.equal(state.meteor.phase, 'waiting');
  assert.equal(state.maze.cells[0][5].left, false, 'the crater is gone');
  assert.ok(!state.landmarks.some(l => l.type === 'impact'));
});

test('a meteor without a trigger goes off METEOR.startMs after the level starts', () => {
  game.setLevels([{ ...LOOP, map: LOOP.map.replace('T', ' ') }, LOOP]);
  game.startLevel(0, now);
  const early = run(METEOR.startMs - FRAME_MS * 2);
  assert.deepEqual(meteorEvents(early), []);
  assert.deepEqual(meteorEvents(run(FRAME_MS * 4)), ['meteorWarn']);
  assert.deepEqual(meteorEvents(run(METEOR.warnMs + FRAME_MS * 2)), ['meteorImpact']);
  assert.equal(state.player.x, 0, 'the rover was still parked');
});

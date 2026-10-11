// Game rules without DOM: level state, input model, movement and winning.
// Time (`now`, ms) and the on-screen cell size are passed in, so this runs under node tests too.

import { blockCell, parseLevel } from '../level-format.js';
import { PLANET_KEYS } from './planets.js';
import {
  DIRS, FIRST_REPEAT_MS, INPUT_LOCK_MS, LIGHTS_FLICKER_MS, LIGHTS_ON_MS, LIGHTS_REARM_MS, METEOR, MAX_STEP_MS, MIN_STEP_MS, TURN_BUFFER_MS, WIN,
} from './config.js';

let levels = [];
export const state = {};
const events = [];

export function setLevels(list) {
  levels = list;
}

export function startLevel(index, now, { restart = false } = {}) {
  index %= levels.length;
  const { planet, dark, storm, meteor, maze, start, goal, landmarks, startDir } = parseLevel(levels[index], index + 1, PLANET_KEYS);
  const facing = Object.values(DIRS).find(d => d.wall === startDir);
  Object.assign(state, {
    index,
    planet,
    dark,
    storm,
    // phase: waiting (for the rover to reach the trigger, or for `at` when there is no trigger)
    // → falling (hits at `at`) → fallen
    meteor: meteor && { ...meteor, phase: 'waiting', at: meteor.trigger ? null : now + METEOR.startMs },
    maze,
    goal,
    landmarks,
    player: { ...start },
    from: { ...start },
    moveStart: -Infinity,
    moveMs: MIN_STEP_MS,
    nextMoveAt: 0,
    moving: false,
    blocked: false,
    bump: null,
    angle: facing.angle,
    targetAngle: facing.angle,
    wonAt: null,
    phase: 'playing',
    inputFrom: now + INPUT_LOCK_MS,
    lightsAt: Infinity,
    lightsOn: false,
    lightsOffAt: null,
    lightsOutAt: -Infinity,
    tracks: [],
    trackKeys: new Set(),
    pendingTrack: null,
  });
  resetInput();
  // Headlights are needed in the dark and inside a storm; the rover waits for them to settle.
  if (needsLights()) {
    state.lightsAt = now + LIGHTS_ON_MS;
    state.inputFrom = state.lightsAt + LIGHTS_FLICKER_MS;
  }
  events.push({ type: 'levelStart', index, restart });
}

const inStorm = ({ x }) => Boolean(state.storm) && x >= state.storm.from && x < state.storm.to;
const needsLights = () => state.dark || inStorm(state.player);

// Crossing the edge of a storm switches the headlights on (they flicker, see night.js) or off.
// They go out only once the step out is finished, and coming straight back in does not restart
// the flicker and the click.
function switchLightsAtStormEdge(now) {
  const want = inStorm(state.player);
  const have = Number.isFinite(state.lightsAt) && state.lightsOffAt === null;
  if (want && !have) {
    const recently = state.lightsOffAt !== null || now - state.lightsOutAt < LIGHTS_REARM_MS;
    state.lightsOffAt = null;
    if (recently) {
      state.lightsAt = now - LIGHTS_FLICKER_MS;
      state.lightsOn = true;
    } else {
      state.lightsAt = now;
    }
  } else if (!want && have) {
    state.lightsOffAt = now + state.moveMs;
  }
}

function setMeteorOff(now) {
  state.meteor.phase = 'falling';
  state.meteor.at = now + METEOR.warnMs;
  // Each fall comes in from its own direction and scatters its own rocks.
  state.meteor.seed = Math.floor(now) % 100000;
  events.push({ type: 'meteorWarn' });
}

export function restartLevel(now) {
  if (state.maze && state.wonAt === null) startLevel(state.index, now, { restart: true });
}

// Directions in press order; `fresh` is a press made with nothing else held (moves at once,
// even if released before the next frame); `buffered` remembers a turn asked for slightly
// before the corridor opens.
// `bySource` tracks which device holds each direction, so releasing it on one device does not
// cancel it while the other still holds it. It survives resetInput(): a direction still held
// from the previous level is ignored until released.
export const input = { held: [], fresh: null, buffered: null, bySource: { key: new Set(), pad: new Set() } };

function resetInput() {
  input.held.length = 0;
  input.fresh = null;
  input.buffered = null;
}

export function press(dir, source, now) {
  input.bySource[source].add(dir);
  if (input.held.includes(dir)) return;
  if (!input.held.length) input.fresh = dir;
  input.held.push(dir);
  input.buffered = { dir, until: now + TURN_BUFFER_MS };
  state.blocked = false;
}

export function release(dir, source) {
  input.bySource[source].delete(dir);
  if (Object.values(input.bySource).some(dirs => dirs.has(dir))) return;
  const i = input.held.indexOf(dir);
  if (i !== -1) input.held.splice(i, 1);
}

// For when a device stops reporting releases, e.g. key-ups while the window is unfocused.
export function forgetSource(source) {
  input.bySource[source].clear();
  resetInput();
}

export function roverPos(now) {
  const t = Math.min(1, (now - state.moveStart) / state.moveMs);
  const { from, player } = state;
  return { x: from.x + (player.x - from.x) * t, y: from.y + (player.y - from.y) * t };
}

const stepMs = cellPx => Math.max(MIN_STEP_MS, Math.min(MAX_STEP_MS, 120 + cellPx * 0.45));

const isOpen = dir => !state.maze.cells[state.player.y][state.player.x][DIRS[dir].wall];

function move(dir, now, cellPx) {
  const { dx, dy, angle } = DIRS[dir];
  const { x, y } = state.player;
  flushTrack();
  state.from = roverPos(now);
  state.player = { x: x + dx, y: y + dy };
  state.moveStart = now;
  state.moveMs = stepMs(cellPx);
  state.targetAngle = angle;
  state.pendingTrack = { a: { x, y }, b: state.player };
  state.moving = true;
  events.push({ type: 'move', dir });
  if (state.storm) switchLightsAtStormEdge(now);
  const { meteor } = state;
  if (meteor?.phase === 'waiting' && meteor.trigger && state.player.x === meteor.trigger.x && state.player.y === meteor.trigger.y) {
    setMeteorOff(now);
  }
  const landmark = state.landmarks.find(l => l.x === state.player.x && l.y === state.player.y);
  if (landmark) events.push({ type: 'landmark', kind: landmark.type });
}

// Tracks are laid once the rover has left them behind, so they never appear ahead of it.
function flushTrack() {
  const seg = state.pendingTrack;
  if (!seg) return;
  state.pendingTrack = null;
  const [p, q] = [seg.a, seg.b].sort((m, n) => m.x - n.x || m.y - n.y);
  const key = `${p.x},${p.y}-${q.x},${q.y}`;
  if (state.trackKeys.has(key)) return;
  state.trackKeys.add(key);
  state.tracks.push(seg);
}

// Advances the game to `now`; returns what happened since the last call:
// levelStart, move, bump, landmark, stop, lightsOn / lightsOff, meteorWarn / meteorImpact,
// the win sequence arrive → ignite → liftoff,
// and finished after the last level's rocket has flown off.
export function update(now, dt, cellPx) {
  step(now, dt, cellPx);
  // While a direction is still held the rover keeps going, even through the key-repeat pause,
  // so the engine sound should not cut out between steps.
  const stepDone = now >= state.moveStart + state.moveMs;
  if (state.moving && stepDone && (!input.held.length || state.blocked)) {
    state.moving = false;
    events.push({ type: 'stop' });
  }
  return events.splice(0);
}

// Phases of the win sequence, entered in order at these times after the rover arrives.
const WIN_PHASES = [
  { phase: 'arrived', event: 'arrive', at: 0 },
  { phase: 'ignited', event: 'ignite', at: WIN.ignite },
  { phase: 'launched', event: 'liftoff', at: WIN.lift },
];

function advanceWin(now) {
  const t = now - state.wonAt;
  for (const p of WIN_PHASES.slice(WIN_PHASES.findIndex(p => p.phase === state.phase) + 1)) {
    if (t < p.at) break;
    state.phase = p.phase;
    events.push({ type: p.event });
  }
}

function step(now, dt, cellPx) {
  const turn = state.targetAngle - state.angle;
  state.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt / 60);
  if (now - state.moveStart >= state.moveMs) flushTrack();

  if (state.phase === 'finished') return;
  if (!state.lightsOn && now >= state.lightsAt) {
    state.lightsOn = true;
    events.push({ type: 'lightsOn' });
  }
  const { meteor } = state;
  if (meteor?.phase === 'waiting' && !meteor.trigger && now >= meteor.at) setMeteorOff(now);
  // While the rover sits on the cell the rock hangs in its last frame (`at` stays), and lands
  // once the rover has moved off; `at` then becomes the real moment of impact.
  if (meteor?.phase === 'falling' && now >= Math.max(meteor.at, meteor.retryAt ?? 0)) {
    const onCell = c => c.x === meteor.cell.x && c.y === meteor.cell.y;
    if (onCell(state.player)) {
      meteor.retryAt = now + METEOR.retryMs;
    } else {
      meteor.phase = 'fallen';
      meteor.at = now;
      state.maze = blockCell(state.maze, meteor.cell);
      state.landmarks.push({ type: 'impact', ...meteor.cell, seed: meteor.seed });
      events.push({ type: 'meteorImpact' });
    }
  }
  if (state.lightsOffAt !== null && now >= state.lightsOffAt) {
    Object.assign(state, { lightsOffAt: null, lightsOutAt: now, lightsAt: Infinity, lightsOn: false });
    events.push({ type: 'lightsOff' });
  }
  if (state.wonAt !== null) {
    resetInput();
    advanceWin(now);
    if (now - state.wonAt <= WIN.next) return;
    if (state.index < levels.length - 1) {
      startLevel(state.index + 1, now);
    } else {
      state.phase = 'finished';
      events.push({ type: 'finished' });
    }
    return;
  }
  if (now < state.inputFrom) { resetInput(); return; }

  if (input.buffered && now > input.buffered.until) input.buffered = null;
  const isFresh = input.fresh !== null;
  // Finish the current step first: cutting it short would slide the rover diagonally past a corner.
  if (isFresh && now < state.moveStart + state.moveMs) return;
  if (!isFresh && (!input.held.length || now < state.nextMoveAt)) return;

  const wanted = [input.buffered?.dir, input.fresh, ...[...input.held].reverse()].filter(Boolean);
  input.fresh = null;
  state.nextMoveAt = now + (isFresh ? FIRST_REPEAT_MS : stepMs(cellPx));

  const dir = wanted.find(isOpen);
  if (!dir) {
    state.targetAngle = DIRS[wanted[0]].angle;
    if (!state.blocked) {
      state.bump = { dir: wanted[0], at: now };
      events.push({ type: 'bump', dir: wanted[0] });
    }
    state.blocked = true;
    return;
  }
  state.blocked = false;
  if (dir === input.buffered?.dir) input.buffered = null;
  move(dir, now, cellPx);

  if (state.player.x === state.goal.x && state.player.y === state.goal.y) state.wonAt = now + state.moveMs;
}

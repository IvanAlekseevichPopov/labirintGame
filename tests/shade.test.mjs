import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../js/game.js';
import { INPUT_LOCK_MS, LIGHTS_FLICKER_MS } from '../js/config.js';
import { PLANET_KEYS } from '../js/planets.js';
import { placeProps } from '../js/props.js';
import { inShade, levelDistances, parseLevel } from '../level-format.js';
import { LEVELS } from '../levels.js';

// A crater round the middle cell (3,2) with r = 2: the floor is the 3×3 block x 2..4, y 1..3,
// the rim the ring of cells round it, rock (X) but for the two passes (1,2) and (5,2) on the way
// from S to R.
const SHADE = { x: 3, y: 2, r: 2 };
const MAP = `
###############
#   #X#X#X#   #
# ########### #
# #X#     #X# #
# ##### ##### #
#S           R#
# ##### ##### #
# #X#     #X# #
# ########### #
#   #X#X#X#   #
###############
`;
const CRATER = { look: 0, planet: 'moon', shade: SHADE, map: MAP };
const parse = (level = {}) => parseLevel({ ...CRATER, ...level }, 40, PLANET_KEYS);

test('a crater: its floor in shadow, its rim rock but for the passes', () => {
  const level = parse();
  assert.deepEqual(level.shade, { ...SHADE, passes: [{ x: 1, y: 2 }, { x: 5, y: 2 }] });
  assert.equal(level.rocks.length, 10);
  assert.ok(inShade(level.shade, { x: 2, y: 1 }), 'a corner of the floor, √2 from the middle');
  assert.ok(!inShade(level.shade, { x: 1, y: 2 }), 'a pass is on the rim, not the floor');
  assert.ok(!inShade(null, { x: 3, y: 2 }));
});

test('the parser refuses rock that is open, on the floor or without a crater', () => {
  assert.throws(() => parse({ map: MAP.replace('# #X#     #X# #\n# #####', '# #X      #X# #\n# #####') }), /скала X открыта/);
  assert.throws(() => parse({ map: MAP.replace('# #X#     #X# #\n# #####', '# #X#X#   #X# #\n# #####') }), /стоит на дне кратера/);
  assert.throws(() => parse({ shade: undefined }), /нужен shade/);
  const far = MAP.replace('#   #X#X#X#   #', '#   #X#X#X# #X#').replace('# ########### #', '# #############');
  assert.throws(() => parse({ map: far }), /далеко от вала/);
});

test('a pass may not lie on the rim\'s inner half, already in the shadow', () => {
  // With r = 2.2 the passes, 2 from the middle, are on the inner half of the rim.
  assert.throws(() => parse({ shade: { ...SHADE, r: 2.2 } }), /внутренней кромке вала/);
});

test('the parser refuses a crater with no pass, under water, at night or in a storm', () => {
  // The rocket by the start, so the way does not need the rim; both passes are rock.
  const shut = MAP.replace('#   #X#X#X#   #\n# ###', '#R  #X#X#X#   #\n# ###').replace('#S           R#', '#S#X#     #X# #');
  assert.throws(() => parse({ map: shut }), /нет перевала/);
  assert.throws(() => parse({ dark: true }), /пелена уже есть/);
  assert.throws(() => parse({ storm: { from: 0.5, to: 1 } }), /пелена уже есть/);
  assert.throws(() => parse({ planet: 'enceladus' }));
});

test('a meteor may fall outside the crater and into it', () => {
  assert.equal(parse({ map: MAP.replace('#   #X#X#X#   #\n###', '#   #X#X#X#  m#\n###') }).meteors.length, 1);
  assert.equal(parse({ map: MAP.replace('# #X#     #X# #\n# ###', '# #X#m    #X# #\n# ###') }).meteors.length, 1);
});

const CELL_PX = 100;
const STEP_MS = 165;
const FRAME_MS = 16;
const { state } = game;
let now;
const run = ms => {
  const events = [];
  for (const end = now + ms; now < end;) {
    now = Math.min(end, now + FRAME_MS);
    events.push(...game.update(now, FRAME_MS, CELL_PX));
  }
  return events;
};
const lightEvents = events => events.filter(e => e.type.startsWith('lights')).map(e => e.type);
// One tap and the whole step it starts.
const step = dir => {
  game.press(dir, 'key', now);
  const events = run(FRAME_MS);
  game.release(dir, 'key');
  return [...events, ...run(STEP_MS + FRAME_MS)];
};

beforeEach(() => {
  now = 1000;
  for (const source of ['key', 'pad']) game.forgetSource(source);
  game.setLevels([CRATER]);
  game.startLevel(0, now);
  run(INPUT_LOCK_MS);
});

test('the headlights come on down on the crater floor, not on the pass, and go off after the step out', () => {
  assert.deepEqual(lightEvents(step('right')), [], 'the pass is in the sun');
  assert.equal(state.player.x, 1);
  assert.deepEqual(lightEvents(step('right')), ['lightsOn']);
  assert.equal(state.player.x, 2);
  run(LIGHTS_FLICKER_MS);
  const out = [...step('left'), ...run(STEP_MS)];
  assert.equal(state.player.x, 1);
  assert.deepEqual(lightEvents(out), ['lightsOff']);
  assert.equal(state.lightsOn, false);
});

test('on level 40 nothing is set on the rim rock, and every decoration can be driven to', () => {
  const index = LEVELS.findIndex(l => l.shade);
  game.setLevels(LEVELS);
  game.startLevel(index, now);
  const reach = levelDistances(state.maze, state.player);
  for (const prop of placeProps(state, 0)) {
    assert.ok(!state.rocks.some(r => r.x === prop.x && r.y === prop.y), `${prop.kind} on rock`);
    assert.ok(reach.has(`${prop.x},${prop.y}`), `${prop.kind} unreachable`);
  }
});

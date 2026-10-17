// Every machine the player drives, in one place: its drawing from above (art.js), in profile and
// head-on (profiles.js), its lamps on the start screen, the beam of its bow lamp and its engine. A
// planet names its machine in planets.js (`rover`); a new machine is added here.
//
// top(cx, cy, angle, size): seen from above, in play; null for a machine only ever seen from the side.
// profile, front: drawings for drawProfile() — front (head-on) only for one that turns round in play.
// lamps: on the start screen at night, in profile space (wheels on y = 0, facing right, 1 = length).
// beam: its bow lamp's beam, for drawBeam().
// engine(out, sound): its hum while it moves, a recipe audio.js plays: `sound` is audio.js's
// helpers ({ ctx, tone, gain, noise, waves }); returns the source nodes to start, connected to `out`.

import { drawIcebreaker, drawLunokhod, drawMarsRover } from './art.js';
import { FRONTS, PROFILES } from './profiles.js';

export const ROVERS = {
  lunokhod: {
    top: drawLunokhod, profile: PROFILES.lunokhod,
    lamps: { front: [[0.42, -0.34], [0.42, -0.26]], rear: [[-0.44, -0.3]] },
    engine(out, { ctx, tone, gain }) {
      const low = tone('triangle', 0, 55);
      const buzz = tone('pulse', 0.125, 110);
      low.connect(gain(0.9, out));
      buzz.connect(gain(0.25, out));
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = gain(10);
      lfo.connect(depth);
      depth.connect(low.detune);
      depth.connect(buzz.detune);
      return [low, buzz, lfo];
    },
  },
  marsRover: {
    top: drawMarsRover, profile: PROFILES.marsRover,
    lamps: { front: [[0.29, -0.44], [0.29, -0.36]], rear: [[-0.33, -0.36]] },
    engine(out, { ctx, tone, gain }) {
      const servo = tone('pulse', 0.25, 165);
      const whine = tone('pulse', 0.125, 247);
      servo.connect(gain(0.55, out));
      whine.connect(gain(0.3, out));
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const depth = gain(35);
      lfo.connect(depth);
      depth.connect(servo.detune);
      depth.connect(whine.detune);
      return [servo, whine, lfo];
    },
  },
  icebreaker: {
    top: drawIcebreaker, profile: PROFILES.icebreaker,
    lamps: { front: [[0.3, -0.27]], rear: [[-0.37, -0.36]] },
    engine(out, { ctx, gain, noise, waves }) {
      const rumble = noise('long', 13);
      rumble.connect(gain(0.8, out));
      // Track clatter: a 12.5% pulse LFO opens the gate for a short burst 6.5 times a second.
      // The normalised wave sits at +1 for the burst and -1/7 otherwise, hence the offset.
      const clack = noise('long', 6);
      const gate = gain(0.45 / 7, out);
      const lfo = ctx.createOscillator();
      lfo.setPeriodicWave(waves[0.125]);
      lfo.frequency.value = 6.5;
      lfo.connect(gain(0.45)).connect(gate.gain);
      clack.connect(gate);
      return [rumble, clack, lfo];
    },
  },
  // Under water, seen only from the side.
  drone: {
    top: null, profile: PROFILES.drone, front: FRONTS.drone,
    beam: { x: 0.3, y: -0.15, length: 1.4, spread: 0.2, dip: 0.12, alpha: 0.32 },
    // A soft whirr of the propeller under water: a low hum with a quiet buzz over it, the buzz
    // beating with the turning blades.
    engine(out, { ctx, tone, gain }) {
      const hum = tone('triangle', 0, 62);
      const whirr = tone('pulse', 0.125, 124);
      hum.connect(gain(0.8, out));
      const blades = gain(0.12, out);
      whirr.connect(blades);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9;
      lfo.connect(gain(0.1)).connect(blades.gain);
      return [hum, whirr, lfo];
    },
  },
};

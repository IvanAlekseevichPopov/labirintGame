// 8-bit sound: a small imitation of the NES APU on Web Audio. Two pulse channels (duty 12.5/25/50%),
// a 32-step triangle, LFSR noise in long and short mode, 4-bit volume steps. Music and jingles
// come from music.js, the rest (bump, ignition, lift-off, engine hum) is synthesised here.
// Nothing touches the browser at import time, so node can test the pure helpers.

import { DRUMS, JINGLES, SONGS, parseSong } from './music.js';

// Balance: effects above music above the engine; `duck` is the music level under the win jingle.
export const VOLUME = { master: 0.5, sfx: 0.6, music: 0.3, engine: 0.07, duck: 0.3 };

const CPU_HZ = 1789773;
const FRAME = 1 / 60;
// How far ahead the music scheduler books notes, and how often it wakes up.
const LOOKAHEAD = 0.4;
const SCHEDULE_MS = 100;
const MUSIC_FADE = 0.3;
const ENGINE_FADE = 0.1;
const PULSE_HARMONICS = 64;
const TRIANGLE_HARMONICS = 96;

export const NOISE_PERIODS = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
export const noiseClock = period => CPU_HZ / NOISE_PERIODS[period];

export const midiToFreq = midi => 440 * 2 ** ((midi - 69) / 12);

// The timers are 11-bit integers, so high notes land slightly off pitch, as on the console.
export function nesPulseFreq(hz) {
  const period = Math.min(2047, Math.max(8, Math.round(CPU_HZ / (16 * hz) - 1)));
  return CPU_HZ / (16 * (period + 1));
}

export function nesTriangleFreq(hz) {
  const period = Math.min(2047, Math.max(2, Math.round(CPU_HZ / (32 * hz) - 1)));
  return CPU_HZ / (32 * (period + 1));
}

export const quantize = level => Math.round(level * 15) / 15;

export const PULSE_STEPS = {
  0.125: [1, 0, 0, 0, 0, 0, 0, 0],
  0.25: [1, 1, 0, 0, 0, 0, 0, 0],
  0.5: [1, 1, 1, 1, 0, 0, 0, 0],
};
export const TRIANGLE_STEPS = [...Array(16).keys()].map(i => 15 - i).concat([...Array(16).keys()]);

// Fourier series of a stepped (sample-and-hold) waveform in the form createPeriodicWave takes.
// Keeping the staircase harmonics is what makes the triangle sound like the console's and not a sine.
export function stepWave(steps, harmonics) {
  const m = steps.length;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    let sumRe = 0;
    let sumIm = 0;
    for (let k = 0; k < m; k++) {
      const phase = (-2 * Math.PI * n * k) / m;
      sumRe += steps[k] * Math.cos(phase);
      sumIm += steps[k] * Math.sin(phase);
    }
    // Each step is a box of width 1/m: multiply by (1 - e^(-2πin/m)) / (2πin).
    const phase = (-2 * Math.PI * n) / m;
    const boxRe = 1 - Math.cos(phase);
    const boxIm = -Math.sin(phase);
    const prodRe = boxRe * sumRe - boxIm * sumIm;
    const prodIm = boxRe * sumIm + boxIm * sumRe;
    const cRe = prodIm / (2 * Math.PI * n);
    const cIm = -prodRe / (2 * Math.PI * n);
    real[n] = 2 * cRe;
    imag[n] = -2 * cIm;
  }
  return { real, imag };
}

// 15-bit shift register of the APU: feedback from bit 1 (long, period 32767) or bit 6
// (short, period 93, a metallic buzz). Returns ±1 per step.
export function lfsrNoise(mode, length) {
  const tap = mode === 'short' ? 6 : 1;
  let reg = 1;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const feedback = (reg ^ (reg >> tap)) & 1;
    reg = (reg >> 1) | (feedback << 14);
    out[i] = reg & 1 ? 1 : -1;
  }
  return out;
}

// Volume shapes in frames of 1/60 s: level(frame, totalFrames, decayFrames) in 0..1.
const ENVELOPES = {
  pluck: (f, n, decay) => Math.max(0, 1 - f / decay),
  hold: (f, n) => (f < n ? 1 : 0),
  soft: (f, n) => Math.min(1, f / 4, (n - f) / 3),
  swell: (f, n) => Math.min(f, n - f) / (n / 2),
};

export function createAudio() {
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null;
  let bus = null;
  const waves = {};
  const noiseBuffers = new Map();
  const parsed = new Map();
  // Remembered while the context is locked, so unlock() can start what the game already asked for.
  const wanted = { planet: null, rover: null, musicOn: true, muted: false };
  let music = null;
  let engine = null;
  let meter = null;

  function unlock() {
    if (!Ctx) return;
    if (!ctx) {
      try {
        ctx = new Ctx();
        build();
      } catch (error) {
        console.warn('звук недоступен', error);
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (wanted.planet) playMusic(wanted.planet);
    if (wanted.rover) setEngine(wanted.rover);
  }

  const gain = (value, to) => {
    const g = ctx.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  };

  function build() {
    // The limiter sits before the master gain, so the master is the final, predictable ceiling.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const master = gain(wanted.muted ? 0 : VOLUME.master);
    limiter.connect(master);
    meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    master.connect(meter).connect(ctx.destination);
    const musicOn = gain(1, limiter);
    const duck = gain(1, musicOn);
    bus = {
      sfx: gain(VOLUME.sfx, limiter),
      music: gain(VOLUME.music, duck),
      engine: gain(VOLUME.engine, limiter),
      duck,
      musicOn,
      master,
    };
    for (const [duty, steps] of Object.entries(PULSE_STEPS)) {
      const { real, imag } = stepWave(steps, PULSE_HARMONICS);
      waves[duty] = ctx.createPeriodicWave(real, imag);
    }
    const { real, imag } = stepWave(TRIANGLE_STEPS, TRIANGLE_HARMONICS);
    waves.triangle = ctx.createPeriodicWave(real, imag);
  }

  // One second of noise with each register step held for the clock period, like the chip does.
  function noiseBuffer(mode, period) {
    const key = `${mode}:${period}`;
    if (!noiseBuffers.has(key)) {
      const rate = ctx.sampleRate;
      const hold = Math.max(1, Math.round(rate / noiseClock(period)));
      const steps = Math.ceil(rate / hold);
      const buffer = ctx.createBuffer(1, steps * hold, rate);
      const data = buffer.getChannelData(0);
      const seq = lfsrNoise(mode, steps);
      for (let i = 0; i < data.length; i++) data[i] = seq[(i / hold) | 0];
      noiseBuffers.set(key, buffer);
    }
    return noiseBuffers.get(key);
  }

  function tone(kind, duty, hz) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(kind === 'triangle' ? waves.triangle : waves[duty]);
    osc.frequency.value = kind === 'triangle' ? nesTriangleFreq(hz) : nesPulseFreq(hz);
    return osc;
  }

  function noise(mode, period) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(mode, period);
    src.loop = true;
    return src;
  }

  // Quantised to 1/15 like the APU, but ramped between frames so steps never click.
  function envelope(param, t0, t1, env, decay, vol) {
    const n = Math.max(2, Math.round((t1 - t0) / FRAME));
    const frame = (t1 - t0) / n;
    const shape = ENVELOPES[env];
    const levels = [];
    for (let f = 0; f <= n; f++) levels.push(f === n ? 0 : quantize(shape(f, n, decay) * vol));
    param.setValueAtTime(0, t0);
    for (let f = 0; f <= n; f++) {
      if (levels[f] === levels[f - 1] && levels[f] === levels[f + 1]) continue;
      param.linearRampToValueAtTime(levels[f], f === 0 ? t0 + 0.003 : t0 + f * frame);
    }
  }

  function vibrato(osc, { hz, cents, delay }, t0, t1) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = hz;
    const depth = gain(0);
    depth.gain.setValueAtTime(0, t0 + delay * FRAME);
    depth.gain.linearRampToValueAtTime(cents, t0 + (delay + 10) * FRAME);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t0);
    lfo.stop(t1 + 0.02);
    return [lfo, depth];
  }

  function release(src, nodes, stopAt) {
    src.stop(stopAt);
    src.onended = () => nodes.forEach(n => n.disconnect());
  }

  function playNote(ch, note, t0, t1, out) {
    const g = gain(0, out);
    let src;
    const extra = [];
    if (ch.kind === 'noise') {
      const drum = DRUMS[note.drum];
      src = noise(drum.mode, drum.period);
      envelope(g.gain, t0, t1, drum.env ?? 'pluck', drum.decay, drum.vol * ch.vol);
      if (drum.sweep) {
        src.playbackRate.setValueAtTime(drum.sweep[0], t0);
        src.playbackRate.exponentialRampToValueAtTime(drum.sweep[1], t1);
      }
    } else {
      src = tone(ch.kind, ch.duty, midiToFreq(note.midi));
      envelope(g.gain, t0, t1, ch.env, ch.decay ?? 10, ch.vol);
      if (ch.vibrato) extra.push(...vibrato(src, ch.vibrato, t0, t1));
    }
    src.connect(g);
    src.start(t0);
    release(src, [src, g, ...extra], t1 + 0.02);
  }

  const songOf = (name, data) => {
    if (!parsed.has(name)) parsed.set(name, parseSong(data, name));
    return parsed.get(name);
  };

  // Notes end a frame early so repeated pitches are heard as separate notes.
  const noteEnd = (t0, ticks, tickSec) => Math.max(t0 + 0.02, t0 + ticks * tickSec - FRAME);

  // Books notes a little ahead of the clock from a timer; all channels wrap at the same tick,
  // so the loop is seamless.
  function startLoop(planet) {
    const song = songOf(planet, SONGS[planet]);
    const out = gain(0, bus.music);
    const now = ctx.currentTime;
    out.gain.linearRampToValueAtTime(1, now + MUSIC_FADE);
    const start = now + 0.05;
    const cursors = song.channels.map(ch => ({ ch, i: 0, tick: 0 }));
    const loop = { planet, out, timer: 0 };
    const pump = () => {
      const horizon = ctx.currentTime + LOOKAHEAD;
      for (const c of cursors) {
        while (start + c.tick * song.tickSec < horizon) {
          const note = c.ch.notes[c.i];
          const t0 = start + c.tick * song.tickSec;
          if (note.midi !== null || note.drum !== null) {
            playNote(c.ch, note, t0, noteEnd(t0, note.ticks, song.tickSec), out);
          }
          c.tick += note.ticks;
          c.i = (c.i + 1) % c.ch.notes.length;
        }
      }
      loop.timer = setTimeout(pump, SCHEDULE_MS);
    };
    pump();
    return loop;
  }

  function stopLoop(loop) {
    clearTimeout(loop.timer);
    const now = ctx.currentTime;
    loop.out.gain.cancelScheduledValues(now);
    loop.out.gain.setValueAtTime(loop.out.gain.value, now);
    loop.out.gain.linearRampToValueAtTime(0, now + MUSIC_FADE);
    // Notes already booked past the fade still end on their own; cutting the bus just silences them.
    setTimeout(() => loop.out.disconnect(), (MUSIC_FADE + LOOKAHEAD) * 1000);
  }

  function playMusic(planet) {
    wanted.planet = planet;
    if (!ctx || !wanted.musicOn || !SONGS[planet]) return;
    if (music?.planet === planet) return;
    if (music) stopLoop(music);
    music = startLoop(planet);
  }

  function stopMusic() {
    wanted.planet = null;
    if (music) stopLoop(music);
    music = null;
  }

  function setMusicEnabled(on) {
    wanted.musicOn = on;
    if (!ctx) return;
    if (!on && music) {
      stopLoop(music);
      music = null;
    }
    if (on && wanted.planet) playMusic(wanted.planet);
  }

  function duckMusic(seconds) {
    if (!ctx) return;
    const now = ctx.currentTime;
    bus.duck.gain.cancelScheduledValues(now);
    bus.duck.gain.setTargetAtTime(VOLUME.duck, now, 0.04);
    if (seconds) bus.duck.gain.setTargetAtTime(1, now + seconds, 0.25);
  }

  // Silences everything (the pause menu's sound switch), unlike setMusicEnabled.
  function setMuted(on) {
    wanted.muted = on;
    if (!ctx) return;
    bus.master.gain.setTargetAtTime(on ? 0 : VOLUME.master, ctx.currentTime, 0.03);
  }

  function unduckMusic() {
    if (!ctx) return;
    const now = ctx.currentTime;
    bus.duck.gain.cancelScheduledValues(now);
    bus.duck.gain.setTargetAtTime(1, now, 0.25);
  }

  function playJingle(name) {
    const song = songOf(name, JINGLES[name]);
    const start = ctx.currentTime + 0.01;
    for (const ch of song.channels) {
      let tick = 0;
      for (const note of ch.notes) {
        const t0 = start + tick * song.tickSec;
        if (note.midi !== null || note.drum !== null) {
          playNote(ch, note, t0, noteEnd(t0, note.ticks, song.tickSec), bus.sfx);
        }
        tick += note.ticks;
      }
    }
    return song.seconds;
  }

  // A source whose pitch and level glide: `points` are [secondsFromT0, level] pairs.
  function sweep({ src, from, to, t0, points, out }) {
    const g = gain(0, out);
    const param = src.playbackRate ? src.playbackRate : src.frequency;
    if (from !== undefined) {
      param.setValueAtTime(from, t0);
      param.exponentialRampToValueAtTime(to, t0 + points[points.length - 1][0]);
    }
    g.gain.setValueAtTime(0, t0);
    for (const [at, level] of points) g.gain.linearRampToValueAtTime(quantize(level), t0 + at);
    src.connect(g);
    src.start(t0);
    release(src, [src, g], t0 + points[points.length - 1][0] + 0.02);
  }

  const SFX = {
    // A barely audible dull knock: the wall is not a mistake, so it must not nag.
    bump() {
      const t0 = ctx.currentTime + 0.005;
      sweep({ src: tone('triangle', 0, 140), from: 140, to: 70, t0, points: [[0.004, 0.18], [0.07, 0]], out: bus.sfx });
      sweep({ src: noise('long', 13), t0, points: [[0.004, 0.06], [0.03, 0]], out: bus.sfx });
      return 0.08;
    },
    ignite() {
      const t0 = ctx.currentTime + 0.005;
      sweep({ src: noise('long', 11), from: 0.7, to: 1.6, t0, points: [[0.4, 0.7], [0.75, 0.7], [1.05, 0]], out: bus.sfx });
      sweep({ src: tone('triangle', 0, 40), from: 40, to: 70, t0, points: [[0.4, 0.6], [0.75, 0.6], [1.05, 0]], out: bus.sfx });
      return 1.05;
    },
    liftoff() {
      const t0 = ctx.currentTime + 0.005;
      sweep({ src: noise('long', 9), from: 0.8, to: 2.4, t0, points: [[0.01, 0.8], [0.5, 0.7], [1.5, 0]], out: bus.sfx });
      sweep({ src: tone('pulse', 0.25, 110), from: 110, to: 1760, t0, points: [[0.01, 0.5], [0.6, 0.4], [1.4, 0]], out: bus.sfx });
      sweep({ src: tone('triangle', 0, 55), from: 55, to: 600, t0, points: [[0.01, 0.8], [0.6, 0.6], [1.4, 0]], out: bus.sfx });
      return 1.5;
    },
  };

  function sfx(name) {
    if (!ctx) return 0;
    if (JINGLES[name]) {
      const seconds = playJingle(name);
      if (name === 'cheer') duckMusic(seconds + 0.3);
      return seconds;
    }
    if (!SFX[name]) {
      console.warn(`нет звука "${name}"`);
      return 0;
    }
    return SFX[name]();
  }

  // Each returns the source nodes to start; they connect themselves to `out`.
  const ENGINES = {
    lunokhod(out) {
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
    marsRover(out) {
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
    icebreaker(out) {
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
  };

  function setEngine(rover) {
    wanted.rover = rover;
    if (!ctx || engine?.rover === rover) return;
    const now = ctx.currentTime;
    if (engine) {
      const { out, nodes } = engine;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + ENGINE_FADE);
      for (const n of nodes) n.stop(now + ENGINE_FADE + 0.02);
      nodes[0].onended = () => out.disconnect();
      engine = null;
    }
    if (!ENGINES[rover]) return;
    const out = gain(0, bus.engine);
    out.gain.linearRampToValueAtTime(1, now + ENGINE_FADE);
    const nodes = ENGINES[rover](out);
    for (const n of nodes) n.start(now);
    engine = { rover, out, nodes };
  }

  return {
    unlock,
    playMusic,
    stopMusic,
    setMusicEnabled,
    setMuted,
    duckMusic,
    unduckMusic,
    setEngine,
    sfx,
    get unlocked() {
      return ctx !== null;
    },
    // Peak of the last ~40 ms of output, 0..1, for the sound test page.
    peak() {
      if (!meter) return 0;
      const data = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(data);
      return data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    },
  };
}

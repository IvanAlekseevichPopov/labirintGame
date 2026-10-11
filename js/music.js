// Music and jingles as data, no Web Audio here so node tests can check them.
//
// Track format: space-separated tokens, `|` between bars is ignored.
//   C5/8    note (C D E F G A B, optional # or b, octave) and length as a note value:
//           /1 whole, /2 half, /4 quarter, /8 eighth, /16, /32; /8. is dotted; /12 is a triplet eighth
//   -/8     rest
//   ~/8     tie: extends the previous note
//   K/8     on the noise channel the letter picks a drum from DRUMS (K kick, S snare, H hat, O open hat, W/w wind)
// A4 = 440 Hz. Pulse channels may use A1..C8, the triangle C1..C6 (what the NES can reach).
//
// Each channel: notes, plus duty (pulse: 0.125, 0.25, 0.5), env (pluck | hold | soft), decay (frames
// of 1/60 s for pluck), vol 0..1 and an optional vibrato { hz, cents, delay (frames) }.
// All channels of a song must be the same length in ticks, or the loop would drift apart.

export const TICKS_PER_WHOLE = 96;

export const PULSE_RANGE = { min: 33, max: 108 };
export const TRIANGLE_RANGE = { min: 24, max: 84 };

// Noise drums: `period` is the NES noise period index (0 = highest pitch, 15 = lowest).
// W and w are wind gusts: a swell over the whole note with the pitch gliding by `sweep`.
export const DRUMS = {
  K: { mode: 'long', period: 12, decay: 5, vol: 1 },
  S: { mode: 'long', period: 7, decay: 8, vol: 0.8 },
  H: { mode: 'long', period: 1, decay: 2, vol: 0.45 },
  O: { mode: 'long', period: 3, decay: 10, vol: 0.4 },
  W: { mode: 'long', period: 8, env: 'swell', sweep: [0.8, 1.3], vol: 0.5 },
  w: { mode: 'long', period: 10, env: 'swell', sweep: [1.2, 0.7], vol: 0.35 },
};

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTALS = { '#': 1, b: -1, '': 0 };

export function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`непонятная нота "${name}"`);
  return 12 * (Number(m[3]) + 1) + SEMITONES[m[1]] + ACCIDENTALS[m[2] ?? ''];
}

export function parseLength(text) {
  const m = /^(\d+)(\.?)$/.exec(text);
  const n = m && Number(m[1]);
  if (!m || !n || TICKS_PER_WHOLE % n !== 0) throw new Error(`непонятная длительность "/${text}"`);
  const ticks = TICKS_PER_WHOLE / n;
  if (m[2] && ticks % 2) throw new Error(`длительность "/${text}" с точкой не делится на тики`);
  return m[2] ? ticks * 1.5 : ticks;
}

// Returns [{ midi, drum, ticks }]: midi for a note, drum for a noise letter, both null for a rest.
export function parseTrack(text) {
  const notes = [];
  for (const token of text.split(/\s+/).filter(t => t && t !== '|')) {
    const slash = token.indexOf('/');
    if (slash === -1) throw new Error(`у "${token}" нет длительности`);
    const head = token.slice(0, slash);
    const ticks = parseLength(token.slice(slash + 1));
    if (head === '~') {
      if (!notes.length) throw new Error('лига "~" в начале дорожки');
      notes[notes.length - 1].ticks += ticks;
    } else if (head === '-') {
      notes.push({ midi: null, drum: null, ticks });
    } else if (head in DRUMS) {
      notes.push({ midi: null, drum: head, ticks });
    } else {
      notes.push({ midi: noteToMidi(head), drum: null, ticks });
    }
  }
  return notes;
}

export const trackTicks = notes => notes.reduce((sum, n) => sum + n.ticks, 0);

const CHANNEL_KINDS = { pulse1: 'pulse', pulse2: 'pulse', triangle: 'triangle', noise: 'noise' };

// Parses every channel and checks they agree in length; the result is what the player schedules.
export function parseSong(song, name = 'song') {
  const channels = Object.entries(song.channels).map(([key, ch]) => {
    const kind = CHANNEL_KINDS[key];
    if (!kind) throw new Error(`${name}: неизвестный канал "${key}"`);
    let notes;
    try {
      notes = parseTrack(ch.notes);
    } catch (error) {
      throw new Error(`${name}.${key}: ${error.message}`);
    }
    for (const n of notes) {
      if (kind === 'noise' && n.midi !== null) throw new Error(`${name}.${key}: нота на шумовом канале`);
      if (kind !== 'noise' && n.drum !== null) throw new Error(`${name}.${key}: ударный "${n.drum}" не на шумовом канале`);
      const range = kind === 'triangle' ? TRIANGLE_RANGE : PULSE_RANGE;
      if (n.midi !== null && (n.midi < range.min || n.midi > range.max)) {
        throw new Error(`${name}.${key}: нота midi ${n.midi} вне диапазона ${range.min}..${range.max}`);
      }
    }
    return { duty: 0.5, env: 'pluck', vol: 0.7, ...ch, key, kind, notes, ticks: trackTicks(notes) };
  });
  if (!channels.length) throw new Error(`${name}: нет каналов`);
  const ticks = channels[0].ticks;
  for (const ch of channels) {
    if (ch.ticks !== ticks) throw new Error(`${name}: канал ${ch.key} длиной ${ch.ticks} тиков, а ${channels[0].key} — ${ticks}`);
  }
  const tickSec = 60 / song.bpm / (TICKS_PER_WHOLE / 4);
  return { bpm: song.bpm, tickSec, ticks, seconds: ticks * tickSec, channels };
}

const repeat = (bar, times) => Array(times).fill(bar).join(' | ');
const arp8 = (a, b, c, d) => `${a}/8 ${b}/8 ${c}/8 ${b}/8 ${d}/8 ${b}/8 ${c}/8 ${b}/8`;
const bass = (root, fifth) => `${root}/2. ${fifth}/4`;
const riff = (a, b) => `-/8 ${a}/8 ${a}/8 -/8 ${b}/8 -/8 ${a}/8 ${a}/8`;
const bounce = (root, octave) => `${root}/8 ${root}/8 ${octave}/8 ${root}/8 ${root}/16 ${root}/16 ${octave}/8 ${root}/8 ${root}/8`;

const octaveDown = track => track.replace(/([A-G][#b]?)(\d)/g, (_, note, octave) => `${note}${octave - 1}`);

const MOON_CHORDS = {
  C: { arp: arp8('C4', 'G4', 'C5', 'E5'), bass: bass('C3', 'G2'), pad: 'C3/1' },
  Am: { arp: arp8('A3', 'E4', 'A4', 'C5'), bass: bass('A2', 'E2'), pad: 'A2/1' },
  F: { arp: arp8('F3', 'C4', 'F4', 'A4'), bass: bass('F2', 'C3'), pad: 'F2/1' },
  G: { arp: arp8('G3', 'D4', 'G4', 'B4'), bass: bass('G2', 'D3'), pad: 'G2/1' },
  Em: { arp: arp8('E3', 'B3', 'E4', 'G4'), bass: bass('E2', 'B2'), pad: 'E2/1' },
};
const MOON_PROGRESSION = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'];
// Night: parallel minors (Am for C, Em for G) in a few spots, a little darker but not sad.
const MOON_NIGHT_PROGRESSION = ['Am', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'Em', 'Am', 'Am', 'F', 'G'];

// D Dorian: minor with a major IV (G), the NES adventure sound. The bass is a bouncing
// root/octave ostinato, pulse2 a syncopated riff on chord tones.
const MARS_CHORDS = {
  Dm: { riff: riff('A4', 'F4'), bass: bounce('D2', 'D3') },
  G: { riff: riff('B4', 'G4'), bass: bounce('G2', 'G3') },
  C: { riff: riff('G4', 'E4'), bass: bounce('C2', 'C3') },
  Am: { riff: riff('A4', 'E4'), bass: bounce('A2', 'A3') },
  F: { riff: riff('C5', 'A4'), bass: bounce('F2', 'F3') },
};
const MARS_A = ['Dm', 'Dm', 'G', 'G', 'Dm', 'Dm', 'C', 'G'];
const MARS_B = ['F', 'G', 'Dm', 'Dm', 'F', 'G', 'Am', 'G'];
const MARS_PROGRESSION = [...MARS_A, ...MARS_B, ...MARS_A];

// E minor, two bars per chord; the bass is tied across them.
const EUROPA_PROGRESSION = ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'Bm', 'Bm', 'Em', 'C', 'Am', 'Bm'];
const EUROPA_BASS = { Em: 'E2', C: 'C2', Am: 'A1', Bm: 'B1' };

const follow = (chords, progression, part) => progression.map(c => chords[c][part]).join(' | ');

const MOON_LEAD_A1 = 'E5/2. G5/4 | A5/2 G5/4 E5/4 | F5/2. A5/4 | G5/1';
const MOON_LEAD_A2 = 'E5/4 G5/4 C6/2 | B5/4 A5/4 G5/2 | A5/2 F5/4 D5/4 | E5/2 -/2';
const MOON_LEAD_B = 'G5/4. E5/8 B4/2 | C5/4. E5/8 A5/2 | A5/4 C6/4 A5/4 F5/4 | G5/2. -/4';
const MOON_LEAD_A3 = 'E5/2. D5/4 | C5/2 E5/4 G5/4 | A5/2 F5/2 | D5/2 B4/4 -/4';
const MOON_LEAD = [MOON_LEAD_A1, MOON_LEAD_A2, MOON_LEAD_B, MOON_LEAD_A3].join(' | ');
// Pieces of the tune surface for two bars at a time, then sink back into the arpeggio.
const MOON_NIGHT_FRAGMENTS = octaveDown([
  '-/1 | -/1 | -/1 | -/1',
  'E5/4 G5/4 C6/2 | B5/4 A5/4 G5/2 | -/1 | -/1',
  '-/1 | -/1 | A5/4 C6/4 A5/4 F5/4 | G5/2. -/4',
  'E5/2. D5/4 | C5/2 E5/4 G5/4 | -/1 | -/1',
].join(' | '));

// Short rising theme; the desert shows only in passing notes (Eb, Bb, C#).
const MARS_LEAD_A = [
  'D5/8 D5/16 D5/16 F5/8 G5/8 A5/4 A5/8 G5/8',
  'A5/8 C6/8 D6/4 C6/8 A5/8 F5/4',
  'G5/8 G5/16 G5/16 B5/8 D6/8 E6/4 D6/8 B5/8',
  'A5/8 B5/8 A5/8 G5/8 E5/2',
  'D5/8 D5/16 D5/16 F5/8 G5/8 A5/4 C6/8 D6/8',
  'Eb6/16 D6/16 C6/8 A5/4 G5/8 F5/8 G5/4',
  'E5/8 G5/8 C6/8 G5/8 A5/4 G5/4',
  'F5/8 E5/8 D5/8 C#5/8 D5/2',
].join(' | ');
const MARS_LEAD_B = [
  'A5/8 A5/16 A5/16 C6/8 D6/8 F6/4 E6/8 C6/8',
  'D6/8 B5/8 G5/8 B5/8 D6/2',
  'F6/8 E6/8 D6/8 C6/8 A5/4 F5/4',
  'G5/8 A5/8 Bb5/16 A5/16 G5/8 F5/8 D5/4 A4/8',
  'C5/8 D5/8 F5/8 G5/8 A5/4 C6/4',
  'B5/8 A5/8 G5/8 A5/8 B5/4 D6/4',
  'E6/8 D6/8 C6/8 B5/8 A5/4 C6/4',
  'B5/8 C#6/8 D6/8 A5/8 G5/4 -/4',
].join(' | ');
const MARS_LEAD = [MARS_LEAD_A, MARS_LEAD_B, MARS_LEAD_A].join(' | ');

// Dust storm: the tune as a duet with its own echo, as on Europa.
const MARS_STORM_ECHO = `-/8 ${MARS_LEAD.replace(/D5\/2$/, 'D5/4.')}`;
const MARS_STORM_WIND_KICK = repeat('K/8 W/4. w/2 | w/1 | K/8 W/4. w/2 | W/2 w/2', 6);

// Sparse drops on the ice; pulse2 repeats them an eighth later and quieter, as an echo.
const EUROPA_LEAD = [
  'B5/8 -/8 -/4 E6/8 -/8 -/4',
  'G5/8 -/8 -/2 -/4',
  'E6/8 -/8 -/4 B5/8 -/8 G5/8 -/8',
  '-/2 D6/8 -/8 -/4',
  'C6/8 -/8 -/4 A5/8 -/8 -/4',
  'E5/8 -/8 -/2 -/4',
  'F#5/8 -/8 B5/8 -/8 -/2',
  'D6/8 -/8 -/4 -/2',
  'E6/8 -/8 -/4 B5/8 -/8 -/4',
  'G5/8 -/8 -/4 E5/8 -/8 -/4',
  'A5/8 -/8 C6/8 -/8 -/2',
  'B5/8 -/8 -/2 -/4',
].join(' | ');
const EUROPA_ECHO = `-/8 ${EUROPA_LEAD.replace(/-\/4$/, '-/8')}`;
const EUROPA_BASS_LINE = EUROPA_PROGRESSION
  .map((c, i) => (EUROPA_PROGRESSION[i - 1] === c && i % 2 ? '~/1' : `${EUROPA_BASS[c]}/1`))
  .join(' | ');
const EUROPA_WIND = [
  'W/1', 'w/1', '-/2 W/2', 'W/1', 'w/2. -/4', 'W/1',
  '-/4 w/2.', 'W/1', 'w/1', 'W/2 w/2', '-/2 W/2', 'w/1',
].join(' | ');

// Looped per planet. Lengths: Moon 16 bars at 84 bpm (~46 s), Mars 24 bars at 120 (48 s),
// Europa 12 bars at 72 (~40 s), the dark Moon 16 bars at 72 (~53 s), the Mars storm 24 bars at 108 (~53 s).
export const SONGS = {
  moon: {
    bpm: 84,
    channels: {
      pulse1: {
        notes: MOON_LEAD,
        duty: 0.5, env: 'soft', vol: 0.55, vibrato: { hz: 5.5, cents: 12, delay: 10 },
      },
      pulse2: { notes: follow(MOON_CHORDS, MOON_PROGRESSION, 'arp'), duty: 0.25, env: 'pluck', decay: 14, vol: 0.4 },
      triangle: { notes: follow(MOON_CHORDS, MOON_PROGRESSION, 'bass'), env: 'soft', vol: 0.8 },
      noise: { notes: repeat('K/4 H/4 -/4 H/4', 16), vol: 0.3 },
    },
  },
  mars: {
    bpm: 120,
    channels: {
      pulse1: {
        notes: MARS_LEAD,
        duty: 0.25, env: 'pluck', decay: 18, vol: 0.55, vibrato: { hz: 6, cents: 8, delay: 14 },
      },
      pulse2: { notes: follow(MARS_CHORDS, MARS_PROGRESSION, 'riff'), duty: 0.125, env: 'pluck', decay: 6, vol: 0.4 },
      triangle: { notes: follow(MARS_CHORDS, MARS_PROGRESSION, 'bass'), env: 'hold', vol: 0.8 },
      noise: { notes: repeat('K/8 H/8 S/8 H/8 K/8 K/16 H/16 S/8 H/16 H/16', 24), vol: 0.35 },
    },
  },
  europa: {
    bpm: 72,
    channels: {
      pulse1: { notes: EUROPA_LEAD, duty: 0.5, env: 'pluck', decay: 22, vol: 0.6 },
      pulse2: { notes: EUROPA_ECHO, duty: 0.25, env: 'pluck', decay: 16, vol: 0.28 },
      triangle: { notes: EUROPA_BASS_LINE, env: 'soft', vol: 1 },
      noise: { notes: EUROPA_WIND, vol: 0.45 },
    },
  },
  // Dark Moon: the arpeggio and a held bass carry the loop; the tune shows up only in fragments,
  // thin and far away, over a soft thump once a bar.
  moonNight: {
    bpm: 72,
    channels: {
      pulse1: { notes: MOON_NIGHT_FRAGMENTS, duty: 0.125, env: 'soft', vol: 0.4, vibrato: { hz: 5, cents: 10, delay: 12 } },
      pulse2: { notes: follow(MOON_CHORDS, MOON_NIGHT_PROGRESSION, 'arp'), duty: 0.25, env: 'pluck', decay: 30, vol: 0.3 },
      triangle: { notes: follow(MOON_CHORDS, MOON_NIGHT_PROGRESSION, 'pad'), env: 'soft', vol: 0.85 },
      noise: { notes: repeat('K/1', 16), vol: 0.12 },
    },
  },
  // Dust storm: the whole tune as a duet with its own echo an eighth behind; the riff and the
  // drums are gone, the bass still bounces, the wind thumps once a bar like a far-off engine.
  marsStorm: {
    bpm: 108,
    channels: {
      pulse1: { notes: MARS_LEAD, duty: 0.25, env: 'pluck', decay: 20, vol: 0.45, vibrato: { hz: 6, cents: 8, delay: 14 } },
      pulse2: { notes: MARS_STORM_ECHO, duty: 0.125, env: 'pluck', decay: 14, vol: 0.25 },
      triangle: { notes: follow(MARS_CHORDS, MARS_PROGRESSION, 'bass'), env: 'hold', vol: 0.8 },
      noise: { notes: MARS_STORM_WIND_KICK, vol: 0.45 },
    },
  },
};

// One-shot sound effects written as tiny songs. Played once, never looped.
export const JINGLES = {
  cheer: {
    bpm: 180,
    channels: {
      pulse1: {
        notes: 'G5/16 G5/16 G5/16 G5/8 -/8 E5/8 G5/8 C6/2.',
        duty: 0.5, env: 'hold', vol: 0.8, vibrato: { hz: 6, cents: 15, delay: 12 },
      },
      pulse2: { notes: 'E5/16 E5/16 E5/16 E5/8 -/8 C5/8 E5/8 G5/2.', duty: 0.25, env: 'hold', vol: 0.5 },
      triangle: { notes: 'C3/4 -/8 -/16 C3/8 G2/8 C3/2.', env: 'hold', vol: 0.9 },
      noise: { notes: 'H/16 H/16 H/16 S/8 -/8 K/8 S/8 O/2.', vol: 0.6 },
    },
  },
  levelStart: {
    bpm: 150,
    channels: {
      pulse1: { notes: 'C5/16 E5/16 G5/8', duty: 0.5, env: 'pluck', decay: 10, vol: 0.7 },
      triangle: { notes: 'C3/8 G3/8', env: 'hold', vol: 0.8 },
    },
  },
  arrive: {
    bpm: 150,
    channels: {
      pulse1: { notes: 'C5/32 E5/32 G5/32 C6/32 E6/32 G6/8', duty: 0.25, env: 'pluck', decay: 12, vol: 0.7 },
      pulse2: { notes: '-/32 C5/32 E5/32 G5/32 C6/32 E6/8', duty: 0.125, env: 'pluck', decay: 8, vol: 0.4 },
      noise: { notes: 'H/32 -/32 H/32 -/32 H/32 O/8', vol: 0.5 },
    },
  },
  landmark: {
    bpm: 150,
    channels: {
      pulse1: { notes: 'E6/32 B6/8', duty: 0.125, env: 'pluck', decay: 10, vol: 0.6 },
      pulse2: { notes: '-/32 E7/8', duty: 0.125, env: 'pluck', decay: 8, vol: 0.3 },
    },
  },
  restart: {
    bpm: 180,
    channels: {
      pulse1: { notes: 'G5/32 F5/32 E5/32 D5/32 C5/32 B4/32 A4/32 G4/16', duty: 0.125, env: 'pluck', decay: 4, vol: 0.6 },
      pulse2: { notes: 'E6/32 D6/32 C6/32 B5/32 A5/32 G5/32 F5/32 E5/16', duty: 0.125, env: 'pluck', decay: 4, vol: 0.3 },
    },
  },
  menu: {
    bpm: 150,
    channels: {
      pulse1: { notes: 'C5/32 G5/8', duty: 0.5, env: 'pluck', decay: 10, vol: 0.7 },
      pulse2: { notes: '-/32 E5/8', duty: 0.25, env: 'pluck', decay: 8, vol: 0.4 },
    },
  },
};

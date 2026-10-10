import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRUMS, JINGLES, PULSE_RANGE, SONGS, TICKS_PER_WHOLE, TRIANGLE_RANGE,
  noteToMidi, parseLength, parseSong, parseTrack, trackTicks,
} from '../js/music.js';
import {
  PULSE_STEPS, TRIANGLE_STEPS, createAudio, lfsrNoise, midiToFreq, nesPulseFreq, nesTriangleFreq,
  quantize, stepWave,
} from '../js/audio.js';

test('note names map to midi numbers', () => {
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('C#5'), 73);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.throws(() => noteToMidi('H4'), /непонятная нота/);
});

test('lengths are note values, dotted ones are half as long again', () => {
  assert.equal(parseLength('1'), TICKS_PER_WHOLE);
  assert.equal(parseLength('8'), TICKS_PER_WHOLE / 8);
  assert.equal(parseLength('8.'), TICKS_PER_WHOLE / 8 * 1.5);
  assert.equal(parseLength('12'), TICKS_PER_WHOLE / 12);
  assert.throws(() => parseLength('5'), /длительность/);
  assert.throws(() => parseLength('0'), /длительность/);
});

test('parses notes, rests, drums, ties and bar lines', () => {
  const notes = parseTrack('C5/8 E5/8 | -/4 ~/8 G5/4.');
  assert.deepEqual(notes.map(n => [n.midi, n.ticks]), [[72, 12], [76, 12], [null, 36], [79, 36]]);
  assert.deepEqual(parseTrack('K/8 -/8')[0], { midi: null, drum: 'K', ticks: 12 });
  assert.equal(trackTicks(notes), 96);
  assert.throws(() => parseTrack('C5'), /нет длительности/);
  assert.throws(() => parseTrack('~/8 C5/8'), /лига/);
});

test('parseSong rejects channels of different length and notes out of range', () => {
  const song = { bpm: 120, channels: { pulse1: { notes: 'C5/4' }, triangle: { notes: 'C3/8' } } };
  assert.throws(() => parseSong(song, 'x'), /x: канал triangle длиной 12 тиков, а pulse1 — 24/);
  assert.throws(() => parseSong({ bpm: 120, channels: { triangle: { notes: 'C7/4' } } }), /вне диапазона/);
  assert.throws(() => parseSong({ bpm: 120, channels: { noise: { notes: 'C5/4' } } }), /нота на шумовом/);
  assert.throws(() => parseSong({ bpm: 120, channels: { pulse1: { notes: 'K/4' } } }), /не на шумовом/);
  assert.throws(() => parseSong({ bpm: 120, channels: { lead: { notes: 'C5/4' } } }), /неизвестный канал/);
});

function checkSong(name, song, { minSeconds, maxSeconds }) {
  test(`${name}: channels agree in length, notes are playable, ${minSeconds}–${maxSeconds} s`, () => {
    const parsed = parseSong(song, name);
    assert.ok(parsed.channels.length >= 1);
    for (const ch of parsed.channels) {
      assert.equal(ch.ticks, parsed.ticks, `${ch.key} length`);
      assert.ok(ch.notes.some(n => n.midi !== null || n.drum !== null), `${ch.key} is silent`);
      const range = ch.kind === 'triangle' ? TRIANGLE_RANGE : PULSE_RANGE;
      for (const n of ch.notes) {
        if (n.midi !== null) assert.ok(n.midi >= range.min && n.midi <= range.max, `${ch.key} midi ${n.midi}`);
        if (n.drum !== null) assert.ok(n.drum in DRUMS);
        assert.ok(Number.isInteger(n.ticks) && n.ticks > 0);
      }
      if (ch.duty !== undefined) assert.ok(ch.duty in PULSE_STEPS, `${ch.key} duty ${ch.duty}`);
    }
    assert.ok(parsed.seconds >= minSeconds && parsed.seconds <= maxSeconds, `${parsed.seconds.toFixed(1)} s`);
  });
}

for (const planet of ['moon', 'mars', 'europa']) assert.ok(SONGS[planet], `no song for ${planet}`);
for (const [name, song] of Object.entries(SONGS)) checkSong(name, song, { minSeconds: 30, maxSeconds: 60 });
for (const [name, song] of Object.entries(JINGLES)) checkSong(name, song, { minSeconds: 0.1, maxSeconds: 2.5 });

test('drums are valid noise settings', () => {
  for (const [name, drum] of Object.entries(DRUMS)) {
    assert.ok(['long', 'short'].includes(drum.mode), name);
    assert.ok(Number.isInteger(drum.period) && drum.period >= 0 && drum.period <= 15, name);
    assert.ok(drum.vol > 0 && drum.vol <= 1, name);
    if (drum.sweep) assert.ok(drum.sweep.every(r => r > 0), name);
  }
});

test('Europa echo follows the lead an eighth later with the same length', () => {
  const { channels } = parseSong(SONGS.europa, 'europa');
  const lead = channels.find(c => c.key === 'pulse1').notes.filter(n => n.midi !== null);
  const echo = channels.find(c => c.key === 'pulse2').notes.filter(n => n.midi !== null);
  assert.deepEqual(echo.map(n => n.midi), lead.map(n => n.midi));
});

test('songs use all four channels and loop on a whole bar', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    assert.deepEqual(Object.keys(song.channels).sort(), ['noise', 'pulse1', 'pulse2', 'triangle'], name);
    assert.equal(parseSong(song, name).ticks % TICKS_PER_WHOLE, 0, name);
  }
});

test('midi to frequency, then to what the NES timers can produce', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(60) - 261.63) < 0.01);
  assert.ok(Math.abs(nesPulseFreq(440) / 440 - 1) < 0.005);
  assert.ok(Math.abs(nesTriangleFreq(110) / 110 - 1) < 0.005);
  assert.ok(nesPulseFreq(10) > 50, 'clamped to the lowest timer value');
  assert.ok(nesTriangleFreq(100000) < 30000, 'clamped to the highest timer value');
});

test('volume is quantised to 16 steps', () => {
  assert.equal(quantize(1), 1);
  assert.equal(quantize(0), 0);
  assert.equal(quantize(0.49), 7 / 15);
  assert.equal(quantize(0.5), 8 / 15);
});

const magnitude = ({ real, imag }, n) => Math.hypot(real[n], imag[n]);

test('50% pulse has only odd harmonics falling as 1/n', () => {
  const wave = stepWave(PULSE_STEPS[0.5], 16);
  assert.ok(magnitude(wave, 1) > 0.5);
  for (const n of [2, 4, 6, 8]) assert.ok(magnitude(wave, n) < 1e-9, `harmonic ${n}`);
  assert.ok(Math.abs(magnitude(wave, 3) / magnitude(wave, 1) - 1 / 3) < 1e-6);
  assert.ok(Math.abs(magnitude(wave, 5) / magnitude(wave, 1) - 1 / 5) < 1e-6);
});

test('12.5% pulse keeps even harmonics', () => {
  const wave = stepWave(PULSE_STEPS[0.125], 16);
  assert.ok(magnitude(wave, 2) > 0.1);
  assert.ok(magnitude(wave, 8) < 1e-9, 'harmonic 8 of an 8-step wave is zero');
});

test('stepped triangle has odd harmonics near 1/n² plus the staircase above the 31st', () => {
  assert.equal(TRIANGLE_STEPS.length, 32);
  const wave = stepWave(TRIANGLE_STEPS, 40);
  for (const n of [2, 4, 6]) assert.ok(magnitude(wave, n) < 1e-9, `harmonic ${n}`);
  assert.ok(Math.abs(magnitude(wave, 3) / magnitude(wave, 1) - 1 / 9) < 0.01);
  assert.ok(magnitude(wave, 31) / magnitude(wave, 1) > 1 / 40, 'staircase harmonic is audible');
  assert.ok(magnitude(wave, 33) / magnitude(wave, 1) > 1 / 40);
});

const hasPeriod = (seq, p) => seq.every((v, i) => i + p >= seq.length || v === seq[i + p]);

test('noise register repeats every 32767 steps in long mode and 93 in short mode', () => {
  const long = lfsrNoise('long', 32767 * 2);
  assert.ok(hasPeriod(long, 32767));
  assert.ok(!hasPeriod(long, 93));
  const short = lfsrNoise('short', 93 * 4);
  assert.ok(hasPeriod(short, 93));
  assert.ok(!hasPeriod(short, 31));
  assert.ok(long.every(v => v === 1 || v === -1));
});

test('createAudio is a silent no-op without Web Audio', () => {
  const audio = createAudio();
  assert.equal(audio.unlocked, false);
  assert.doesNotThrow(() => {
    audio.unlock();
    audio.playMusic('moon');
    audio.setEngine('lunokhod');
    audio.sfx('bump');
    audio.sfx('cheer');
    audio.duckMusic(1);
    audio.unduckMusic();
    audio.setMusicEnabled(false);
    audio.stopMusic();
    audio.setEngine(null);
  });
  assert.equal(audio.sfx('bump'), 0);
  assert.equal(audio.unlocked, false);
});

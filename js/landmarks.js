// Everything the game knows about each kind of landmark, in one place: its letter in a level,
// how it is drawn, whether it chimes when driven over and whether it carries a light at night.
// The rule behind the values: only things people left there feel like a checkpoint, so only
// those chime and glow; a crater or a polynya is just ground.
//
// upright: drawn on the main canvas each frame in side view, draw(cx, baseY, size, now).
// Otherwise it is part of the ground, drawn once into the maze layer, draw(g, x, y, r, palette).
// light(now): { r (cells), strength 0..1, color 'r,g,b' } or null.

import { drawAntenna, drawBigCrater, drawFlag } from './art.js';

export const LANDMARKS = {
  flag: {
    char: 'F', chime: true, upright: true, draw: drawFlag,
    light: () => ({ r: 0.85, strength: 0.75, color: '255,220,150' }),
  },
  antenna: {
    char: 'A', chime: true, upright: true, draw: drawAntenna,
    // Blinks in step with the red lamp drawAntenna paints.
    light: now => ({ r: 0.8, strength: Math.floor(now / 600) % 2 ? 0.85 : 0.3, color: '255,70,50' }),
  },
  crater: { char: 'C', chime: false, upright: false, draw: drawBigCrater, light: null },
};

// 'F' → 'flag'
export const LANDMARK_BY_CHAR = Object.fromEntries(Object.entries(LANDMARKS).map(([type, l]) => [l.char, type]));

// What the night and the storm share: the overlay layer, the frame clock, and the lights that
// are the same under any veil (tracks showing through, landmarks with a lamp, the rocket's
// beacon and its flame). Each veil adds its own cover and its own lights around these.

import { radial } from './headlights.js';
import { LANDMARKS } from './landmarks.js';

// Frame time from the game clock, capped so a long pause does not jump the particles.
export function createClock() {
  let last = null;
  return now => {
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    return dt;
  };
}

export function layerContext(layer) {
  const g = layer.getContext('2d');
  const dpr = devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return g;
}

// Deterministic flicker in [0, 1): on pause the clock stops and so does the flame.
export const jitter = now => { const v = Math.sin(now / 23) * 43758.5453; return v - Math.floor(v); };

const beaconPulse = now => 0.6 + 0.4 * Math.max(0, Math.sin(now / 350));

// Cuts the shared lights out of the veil (g must be in destination-out). `dim` scales the
// landmark lights, `beacon` is { r, strength } in cells, `flame` the radius the blast clears.
// Returns the landmarks that have a light, for paintCommon.
export function cutCommon(g, scene, now, { tracks, dim = 1, beacon, flame }) {
  const { w, h, cell } = scene;
  // Old tracks stay faintly visible: a trail of where the rover has already been.
  g.globalAlpha = tracks;
  g.drawImage(scene.trackLayer, 0, 0, w, h);
  g.globalAlpha = 1;

  const lit = scene.landmarks.map(l => ({ ...l, light: LANDMARKS[l.type].light?.(now) })).filter(l => l.light);
  for (const { x, y, light } of lit) radial(g, x, y, cell * light.r * dim, light.strength * dim);
  radial(g, scene.goal.x, scene.goal.y, cell * beacon.r * beaconPulse(now), beacon.strength);
  if (scene.flame) radial(g, scene.goal.x, scene.goal.y, cell * flame, 0.95 + 0.05 * jitter(now));
  return lit;
}

// Colour over the shared holes, so each light looks like its own kind of light.
export function paintCommon(ctx, scene, now, lit, { dim = 1, flame }) {
  const { cell } = scene;
  for (const { x, y, light } of lit) radial(ctx, x, y, cell * light.r * dim, light.strength * 0.3 * dim, light.color);
  if (scene.flame) radial(ctx, scene.goal.x, scene.goal.y, cell * flame, 0.2 + 0.05 * jitter(now), '255,170,80');
}

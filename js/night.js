// Night on a dark level: the scene is drawn as usual, then covered with black that only the
// lights cut through: the rover's headlights (headlights.js), a glow around the landmarks, the
// beacon on the rocket, meteor impacts. Drawn by render.js after the rover.

import { createHeadlights, headlightPreset, radial } from './headlights.js';

export const NIGHT = {
  glow: 0.95,       // faint light around the rover itself, cells
  beacon: 0.55,
  dark: 'rgba(3, 4, 14, 0.985)',
};

// Switching on: dark, a couple of flickers, then steady. [ms since lightsAt, brightness].
const SWITCH_ON = [[80, 1], [150, 0.1], [230, 1], [290, 0.25], [Infinity, 1]];
export function brightness(sinceLightsAt, now) {
  if (sinceLightsAt < 0) return 0;
  const level = SWITCH_ON.find(([until]) => sinceLightsAt < until)[1];
  return level * (0.97 + 0.03 * Math.sin(now / 90) * Math.sin(now / 37));
}

// Radius in cells, how much light, and its colour (null for none) on top of the hole.
const LANDMARK_LIGHTS = {
  antenna: now => ({ r: 0.8, strength: Math.floor(now / 600) % 2 ? 0.85 : 0.3, tint: '255,70,50' }),
  flag: () => ({ r: 0.85, strength: 0.75, tint: '255,220,150' }),
  crater: () => ({ r: 0.7, strength: 0.35, tint: null }),
};

// Deterministic flicker in [0, 1): on pause the clock stops and so does the flame.
const jitter = now => (Math.sin(now / 23) * 43758.5453) % 1;

export function createNight(planet) {
  const headlights = createHeadlights(headlightPreset('night', planet));
  let last = null;

  // scene: { w, h, cell, walls (px segments), rover: { x, y, angle, size } | null, goal: { x, y },
  //         flame, landmarks: [{ type, x, y }] (px), sinceLightsAt, lights: [{ x, y, r, strength }],
  //         trackLayer }
  return function drawNight(ctx, layer, now, scene) {
    const { w, h, cell, rover } = scene;
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const b = brightness(scene.sinceLightsAt, now);

    const g = layer.getContext('2d');
    const dpr = devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = 1;
    g.fillStyle = NIGHT.dark;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'destination-out';
    // Old tracks stay faintly visible: a trail of where the rover has already been.
    g.globalAlpha = 0.55;
    g.drawImage(scene.trackLayer, 0, 0, w, h);
    g.globalAlpha = 1;

    if (rover) radial(g, rover.x, rover.y, cell * NIGHT.glow, 0.3 + 0.7 * b);
    headlights.cut(g, scene, b);

    const lit = scene.landmarks.map(l => ({ ...l, light: LANDMARK_LIGHTS[l.type]?.(now) })).filter(l => l.light);
    for (const { x, y, light } of lit) radial(g, x, y, cell * light.r, light.strength);
    const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(now / 350));
    radial(g, scene.goal.x, scene.goal.y, cell * NIGHT.beacon * pulse, 0.9);
    if (scene.flame) radial(g, scene.goal.x, scene.goal.y, cell * 5, 0.95 + 0.05 * jitter(now));
    for (const l of scene.lights) radial(g, l.x, l.y, l.r, l.strength);

    ctx.drawImage(layer, 0, 0, w, h);

    // Colour on top of the holes, so each light looks like its own kind of light.
    headlights.paint(ctx, scene, b, dt);
    for (const { x, y, light } of lit) {
      if (light.tint) radial(ctx, x, y, cell * light.r, light.strength * 0.3, light.tint);
    }
    for (const l of scene.lights) radial(ctx, l.x, l.y, l.r, 0.35 * l.strength, '255,190,120');
    if (scene.flame) radial(ctx, scene.goal.x, scene.goal.y, cell * 5, 0.2 + 0.05 * jitter(now), '255,170,80');
  };
}

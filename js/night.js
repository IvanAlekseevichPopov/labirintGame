// Night on a dark level: the scene is drawn as usual, then covered with black that only the
// lights cut through: the rover's headlights (headlights.js), a glow around the landmarks, the
// beacon on the rocket, meteor impacts. Drawn by render.js after the rover.

import { createHeadlights, headlightPreset, radial } from './headlights.js';
import { clipToMaze, createClock, cutCommon, layerContext, paintCommon } from './veil.js';

export const NIGHT = {
  glow: 0.95,       // faint light around the rover itself, cells
  beacon: 0.55,
  flame: 5,         // how far the rocket's blast lights the ground, cells
  dark: 'rgba(3, 4, 14, 0.985)',
};

// Switching on: dark, a couple of flickers, then steady. [ms since lightsAt, brightness].
const SWITCH_ON = [[80, 1], [150, 0.1], [230, 1], [290, 0.25], [Infinity, 1]];
export function brightness(sinceLightsAt, now) {
  if (sinceLightsAt < 0) return 0;
  const level = SWITCH_ON.find(([until]) => sinceLightsAt < until)[1];
  return level * (0.97 + 0.03 * Math.sin(now / 90) * Math.sin(now / 37));
}

export function createNight(planet) {
  const headlights = createHeadlights(headlightPreset('night', planet));
  const clock = createClock();

  // scene: { w, h, cell, walls (px segments), rover: { x, y, angle, size, draw } | null,
  //         goal: { x, y }, flame, launch, landmarks: [{ type, x, y }] (px), sinceLightsAt,
  //         lights: [{ x, y, r, strength }], trackLayer }
  return function drawNight(ctx, layer, now, scene) {
    const { w, h, cell, rover } = scene;
    const dt = clock(now);
    const b = brightness(scene.sinceLightsAt, now);

    const g = layerContext(layer);
    g.globalCompositeOperation = 'copy';
    g.fillStyle = NIGHT.dark;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'destination-out';
    const lit = cutCommon(g, scene, now, { tracks: 0.55, beacon: { r: NIGHT.beacon, strength: 0.9 }, flame: NIGHT.flame });
    g.save();
    clipToMaze(g, scene);
    if (rover) radial(g, rover.x, rover.y, cell * NIGHT.glow, 0.3 + 0.7 * b);
    headlights.cut(g, scene, b);
    g.restore();
    for (const l of scene.lights) radial(g, l.x, l.y, l.r, l.strength);

    ctx.drawImage(layer, 0, 0, w, h);

    ctx.save();
    clipToMaze(ctx, scene);
    headlights.paint(ctx, scene, b, dt);
    ctx.restore();
    paintCommon(ctx, scene, now, lit, { flame: NIGHT.flame });
    for (const l of scene.lights) radial(ctx, l.x, l.y, l.r, 0.35 * l.strength, '255,190,120');
  };
}

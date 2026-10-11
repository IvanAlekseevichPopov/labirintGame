// A dust storm standing over part of a Mars level: inside it the rover sees only a little way
// around itself, the rest is a wall of blowing sand. Same idea as the night (night.js), but the
// veil is dust, not dark, and it has an edge you can drive out of.

import { createHeadlights, fillPolygon, headlightPreset, radial } from './headlights.js';

export const STORM = {
  see: 0.5,        // glow right around the rover inside the storm, cells
  haze: '214,124,78',
  density: 0.96,   // opacity of the veil deep inside
  edge: 0.6,       // how far the front billows, cells
  grains: 220,
  speed: 7,        // grain speed, cells per second
};

const noise = (y, now) => Math.sin(y * 1.7 + now / 900) * 0.6 + Math.sin(y * 4.3 - now / 600) * 0.4;

// scene: { w, h, cell, area: { x, y, w, h, cols }, rover, goal, flame, landmarks, trackLayer }
// `span` is the storm's extent as fractions of the maze width: { from, to }.
export function createStorm(span, planet) {
  const grains = Array.from({ length: STORM.grains }, () => ({
    x: Math.random(), y: Math.random(), speed: 0.7 + Math.random() * 0.6, len: 0.5 + Math.random(),
    dark: Math.random() < 0.35,
  }));
  const headlights = createHeadlights(headlightPreset('storm', planet));
  const clouds = Array.from({ length: 7 }, (_, i) => ({ u: Math.random(), v: Math.random(), r: 0.9 + Math.random() * 0.8, phase: i * 1.3 }));
  let last = null;

  // The front: points down one side of the storm, wobbling with time.
  const front = (fraction, area, cell, now, sign) => {
    const x0 = area.x + area.w * fraction;
    const pts = [];
    for (let y = area.y - cell; y <= area.y + area.h + cell; y += cell / 4) {
      pts.push([x0 + sign * cell * STORM.edge * (noise(y / cell, now) + 0.4 * Math.sin(now / 4000)), y]);
    }
    return pts;
  };

  return function drawStorm(ctx, layer, now, scene) {
    const { w, h, cell, area, rover } = scene;
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const gust = 0.5 + 0.5 * Math.sin(now / 1700) * Math.sin(now / 530);
    const left = span.from > 0 ? front(span.from, area, cell, now, -1) : [[area.x - cell * 2, area.y - cell], [area.x - cell * 2, area.y + area.h + cell]];
    const right = span.to < 1 ? front(span.to, area, cell, now, 1) : [[area.x + area.w + cell * 2, area.y - cell], [area.x + area.w + cell * 2, area.y + area.h + cell]];
    const polygon = [...left, ...right.reverse()];
    const stormX = Math.min(...polygon.map(p => p[0])), stormW = Math.max(...polygon.map(p => p[0])) - stormX;

    const g = layer.getContext('2d');
    const dpr = devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    // The storm sits on the ground: it stops a little past the maze and never covers the sky.
    const ground = [area.x - cell * 0.35, area.y - cell * 0.35, area.w + cell * 0.7, area.h + cell * 0.7, cell * 0.3];
    g.save();
    g.beginPath();
    g.roundRect(...ground);
    g.clip();
    fillPolygon(g, polygon, `rgba(${STORM.haze},${STORM.density})`);
    // Billows along the front, so the edge is a rolling wall and not a line.
    for (const pts of [left, right]) {
      if (pts.length < 3) continue;
      for (let i = 2; i < pts.length - 2; i += 3) {
        const [x, y] = pts[i];
        const r = cell * (0.45 + 0.25 * Math.sin(now / 700 + i));
        radial(g, x, y, r, STORM.density * 0.8, STORM.haze);
      }
    }
    // Churning clouds inside, a little lighter, drifting with the wind.
    for (const c of clouds) {
      c.u = (c.u + dt * 0.03 * c.r) % 1;
      const x = stormX + c.u * stormW, y = area.y + c.v * area.h;
      radial(g, x, y, cell * c.r, 0.25 + 0.15 * Math.sin(now / 1300 + c.phase), '240,180,130');
    }

    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.45;
    g.drawImage(scene.trackLayer, 0, 0, w, h);
    g.globalAlpha = 1;
    if (rover) radial(g, rover.x, rover.y, cell * STORM.see * (0.9 + 0.2 * gust), 0.7);
    headlights.cut(g, scene, 1);
    for (const l of scene.landmarks) {
      if (l.type === 'antenna') radial(g, l.x, l.y, cell * 0.7, Math.floor(now / 600) % 2 ? 0.6 : 0.15);
    }
    const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(now / 350));
    radial(g, scene.goal.x, scene.goal.y, cell * 0.6 * pulse, 0.6);
    if (scene.flame) radial(g, scene.goal.x, scene.goal.y, cell * 4, 0.9);
    g.restore();

    ctx.drawImage(layer, 0, 0, w, h);
    headlights.paint(ctx, scene, 1, dt);

    // Sand streaking through the storm, drawn only inside it.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(...ground);
    ctx.clip();
    ctx.beginPath();
    polygon.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y));
    ctx.closePath();
    ctx.clip();
    ctx.lineCap = 'round';
    for (const s of grains) {
      s.x += dt * STORM.speed * cell * s.speed * (0.7 + 0.6 * gust) / stormW;
      if (s.x > 1) { s.x -= 1; s.y = Math.random(); }
      const x = stormX + s.x * stormW, y = area.y + s.y * area.h + Math.sin(now / 200 + s.len * 9) * cell * 0.05;
      ctx.strokeStyle = s.dark ? 'rgba(122, 52, 24, 0.55)' : 'rgba(250, 214, 170, 0.7)';
      ctx.lineWidth = cell * 0.025;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - cell * 0.12 * s.len * (0.6 + gust), y);
      ctx.stroke();
    }
    ctx.restore();
  };
}

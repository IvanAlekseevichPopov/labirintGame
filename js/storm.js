// A dust storm standing over part of a Mars level: inside it the rover sees only by its
// headlights, the rest is a wall of blowing sand. Same idea as the night (night.js), but the
// veil is dust, not dark, and it has an edge you can drive out of.

import { createHeadlights, fillPolygon, headlightPreset, radial } from './headlights.js';
import { brightness } from './night.js';
import { createClock, cutCommon, layerContext, paintCommon } from './veil.js';

export const STORM = {
  see: 0.5,        // glow right around the rover inside the storm, cells
  around: 0.9,     // weaker glow that shows the openings next to the rover, cells
  haze: '214,124,78',
  density: 0.96,   // opacity of the veil deep inside
  edge: 0.6,       // how far the front billows, cells
  grains: 220,
  speed: 7,        // grain speed, cells per second
  blast: 3,        // how far the rocket's blast pushes the dust back at ignition, cells
  blastLift: 4,    // and how much further by the end of the lift-off
};

// The front moves up to STORM.edge * 1.4 cells either side of its line.
const noise = (y, now, phase) => Math.sin(y * 1.7 + now / 900 + phase) * 0.6 + Math.sin(y * 4.3 - now / 600 + phase) * 0.4;

// The storm's outline in px: `left` and `right` run top to bottom along each front (two points
// where the storm just runs off the maze), `polygon` goes round, and `x0`/`x1` are the storm's
// cell bounds. The fronts billow inwards from those bounds, never over a cell that counts as
// outside (game.js inStorm). `area` is the maze on screen, `span` { from, to } in cell columns.
export function stormOutline(span, area, cell, now) {
  const reach = cell * STORM.edge * 1.4;
  const front = (line, sign, phase) => {
    const pts = [];
    for (let y = area.y - cell; y <= area.y + area.h + cell; y += cell / 4) {
      pts.push([line + sign * cell * STORM.edge * (noise(y / cell, now, phase) + 0.4 * Math.sin(now / 4000 + phase)), y]);
    }
    return pts;
  };
  const off = (x) => [[x, area.y - cell], [x, area.y + area.h + cell]];
  const x0 = span.from > 0 ? area.x + cell * span.from : area.x - cell * 2;
  const x1 = span.to < area.cols ? area.x + cell * span.to : area.x + area.w + cell * 2;
  const left = span.from > 0 ? front(x0 + reach, -1, 0) : off(x0);
  const right = span.to < area.cols ? front(x1 - reach, 1, 2.3) : off(x1);
  return { left, right, polygon: [...left, ...right.slice().reverse()], x0, x1 };
}

const clipPolygon = (c, pts) => {
  c.beginPath();
  pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y));
  c.closePath();
  c.clip();
};

export function createStorm(span, planet) {
  const grains = Array.from({ length: STORM.grains }, () => ({
    x: Math.random(), y: Math.random(), speed: 0.7 + Math.random() * 0.6, len: 0.5 + Math.random(),
    dark: Math.random() < 0.35,
  }));
  const clouds = Array.from({ length: 7 }, (_, i) => ({ u: Math.random(), v: Math.random(), r: 0.9 + Math.random() * 0.8, phase: i * 1.3 }));
  const headlights = createHeadlights(headlightPreset('storm', planet));
  const clock = createClock();

  return function drawStorm(ctx, layer, now, scene) {
    const { w, h, cell, area, rover } = scene;
    const dt = clock(now);
    const gust = 0.5 + 0.5 * Math.sin(now / 1700) * Math.sin(now / 530);
    const { left, right, polygon, x0, x1 } = stormOutline(span, area, cell, now);
    const stormW = x1 - x0;
    // The lights come on as the rover enters the storm and go out as it leaves.
    const b = brightness(scene.sinceLightsAt, now);
    const blast = STORM.blast + STORM.blastLift * scene.launch;

    const g = layerContext(layer);
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
    // Churning clouds inside, a little lighter, drifting with the wind and fading at the fronts.
    g.save();
    clipPolygon(g, polygon);
    for (const c of clouds) {
      c.u = (c.u + dt * 0.03 * c.r) % 1;
      const x = x0 + c.u * stormW, y = area.y + c.v * area.h;
      radial(g, x, y, cell * c.r, (0.25 + 0.15 * Math.sin(now / 1300 + c.phase)) * Math.sin(Math.PI * c.u), '240,180,130');
    }
    g.restore();

    g.globalCompositeOperation = 'destination-out';
    // Landmark lights show through the dust dimmer than at night; the blast widens as the rocket climbs.
    const lit = cutCommon(g, scene, now, { tracks: 0.45, dim: 0.8, beacon: { r: 0.6, strength: 0.6 }, flame: blast });
    if (rover) {
      radial(g, rover.x, rover.y, cell * STORM.see * (0.9 + 0.2 * gust), 0.7 * b);
      radial(g, rover.x, rover.y, cell * STORM.around, 0.3 * b);
    }
    headlights.cut(g, scene, b);
    g.restore();

    ctx.drawImage(layer, 0, 0, w, h);
    // The rover itself stays solid in the dust, so it is never lost on the screen.
    rover?.draw();

    // Headlight colour and sand only inside the storm: in clear air the beams are invisible.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(...ground);
    ctx.clip();
    clipPolygon(ctx, polygon);
    headlights.paint(ctx, scene, b, dt);
    // Sand streaks, one path per colour.
    ctx.lineCap = 'round';
    ctx.lineWidth = cell * 0.025;
    for (const [dark, color] of [[false, 'rgba(250, 214, 170, 0.7)'], [true, 'rgba(122, 52, 24, 0.55)']]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (const s of grains) {
        if (s.dark !== dark) continue;
        s.x += dt * STORM.speed * cell * s.speed * (0.7 + 0.6 * gust) / stormW;
        if (s.x > 1) { s.x -= 1; s.y = Math.random(); }
        const x = x0 + s.x * stormW, y = area.y + s.y * area.h + Math.sin(now / 200 + s.len * 9) * cell * 0.05;
        ctx.moveTo(x, y);
        ctx.lineTo(x - cell * 0.12 * s.len * (0.6 + gust), y);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Lamp colours and the flame's glow are not clipped: the rocket climbs above the maze.
    paintCommon(ctx, scene, now, lit, { dim: 0.8, flame: blast });
  };
}

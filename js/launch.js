// Smoke of the rocket launch: from ignition the exhaust spreads along the ground both ways as
// dust of the planet's colour, then the rising rocket leaves a white trail of puffs behind.
// Each puff is fixed by its index, so a frame is a pure function of the time since the win.
// Cartoon look: overlapping puffs share one outline, like the rest of the art.

import { WIN } from './config.js';
import { mulberry32 } from './random.js';

const OUTLINE = '#1c1e26';
const GROUND = { from: WIN.ignite, to: WIN.lift + 500, every: 45, life: 1300 };
// Trail puffs are laid by distance, not time, or they string out into beads as the rocket speeds up.
const TRAIL = { spacing: 0.12, life: 900 };

// Grows quickly, holds, then shrinks away: puffs vanish by size, not by fading, to keep the outline crisp.
function swell(t) {
  return t < 0.25 ? t / 0.25 : t > 0.65 ? (1 - t) / 0.35 : 1;
}

function puffs(kind, winT, place) {
  const out = [];
  for (let i = 0, born = kind.from; born <= Math.min(winT, kind.to); i++, born += kind.every) {
    const t = (winT - born) / kind.life;
    if (t >= 1) continue;
    out.push(place(t, mulberry32(i * 7), i));
  }
  return out;
}

function drawCloud(ctx, list, lineWidth, shade, light) {
  for (const [color, grow, dx, dy, k] of [
    [OUTLINE, lineWidth, 0, 0, 1],
    [shade, 0, 0, 0, 1],
    [light, 0, -0.15, -0.2, 0.7],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const p of list) {
      if (p.r <= 0) continue;
      ctx.moveTo(p.x + p.r * dx + p.r * k + grow, p.y + p.r * dy);
      ctx.arc(p.x + p.r * dx, p.y + p.r * dy, p.r * k + grow, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

// `climb` is how far the rocket rises over the launch, px. The dust stays inside `area`
// (the maze), it is kicked up from the ground; the trail follows the rocket out into the sky.
export function drawLaunchSmoke(ctx, winT, { x, padY, cell, climb, palette, area }) {
  if (winT === null || winT < WIN.ignite) return;
  const ground = puffs(GROUND, winT, (t, rand, i) => {
    const side = i % 2 ? 1 : -1;
    const reach = cell * (0.6 + rand() * 0.7);
    const out = 1 - Math.exp(-t * 3);
    return {
      x: x + side * (cell * 0.15 + reach * out),
      y: padY + cell * 0.05 - cell * (0.1 + rand() * 0.15) * out,
      r: cell * (0.14 + rand() * 0.1) * (0.6 + 0.6 * t) * swell(t),
    };
  });
  const trail = [];
  for (let i = 1, h = 0; (h = i * TRAIL.spacing * cell) <= climb; i++) {
    // Inverse of the rocket's lift, which grows with the square of time.
    const born = WIN.lift + WIN.liftMs * Math.sqrt(h / climb);
    const t = (winT - born) / TRAIL.life;
    if (t < 0) break;
    if (t >= 1) continue;
    const rand = mulberry32(i * 13);
    trail.push({
      x: x + (rand() - 0.5) * cell * 0.25 * (1 + t),
      y: padY - h + cell * 0.3,
      r: cell * (0.1 + rand() * 0.06) * (1 + 1.2 * t) * swell(t),
    });
  }
  const lineWidth = cell * 0.035;
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  drawCloud(ctx, ground, lineWidth, palette.craterRim, 'rgba(255, 255, 255, 0.35)');
  ctx.restore();
  drawCloud(ctx, trail, lineWidth, '#dfe3ea', '#ffffff');
}

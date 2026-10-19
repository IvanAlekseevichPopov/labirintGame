// The meteor event on screen: a shadow growing on the target cell while it falls, the streak,
// the flash, a ring of dust and flying rocks, and a short shake of the whole picture. The crater
// it leaves is a landmark (landmarks.js: impact) drawn into the maze layer.

import { METEOR } from './config.js';
import { mulberry32 } from './random.js';

const clamp01 = v => Math.max(0, Math.min(1, v));

// Offset to translate the whole frame by, px; zero when nothing is shaking.
export function meteorShake(meteors, now, cell) {
  const t = Math.min(...meteors.filter(m => m.phase === 'fallen').map(m => (now - m.at) / METEOR.shakeMs).filter(t => t >= 0));
  if (!(t < 1)) return [0, 0];
  const amp = cell * 0.05 * (1 - t);
  return [Math.sin(now / 11) * amp, Math.cos(now / 13) * amp];
}

// Drawn after the rover, before any veil. `toPx` maps a cell to its centre.
// Where this fall comes from and how its rocks fly, fixed for the fall by its seed.
function fallStyle(seed) {
  const rand = mulberry32(seed);
  // Always from above the horizon, so it reads as coming out of the sky.
  const from = -Math.PI / 2 + (rand() - 0.5) * 1.6;
  const rocks = Array.from({ length: 14 }, () => ({ a: rand() * Math.PI * 2, v: 1.2 + rand() * 1.6, r: 0.8 + rand() * 0.5 }));
  return { from, rocks };
}

export function drawMeteor(ctx, meteor, now, cell, toPx) {
  if (meteor.phase === 'waiting') return;
  const [x, y] = toPx(meteor.cell);
  const style = fallStyle(meteor.seed ?? 0);
  if (meteor.phase === 'falling') {
    const t = clamp01(1 - (meteor.at - now) / METEOR.warnMs);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.4 * t})`;
    ctx.beginPath();
    ctx.ellipse(x, y, cell * (0.15 + 0.3 * t), cell * (0.1 + 0.2 * t), 0, 0, Math.PI * 2);
    ctx.fill();
    // The rock itself shows for the last third of the fall.
    if (t > 0.66) {
      const f = (t - 0.66) / 0.34;
      const dx = Math.cos(style.from) * cell * 11, dy = Math.sin(style.from) * cell * 11;
      const fx = x + (1 - f) * dx, fy = y + (1 - f) * dy;
      const tail = 0.2;
      const grad = ctx.createLinearGradient(fx + dx * tail, fy + dy * tail, fx, fy);
      grad.addColorStop(0, 'rgba(255, 240, 200, 0)');
      grad.addColorStop(1, 'rgba(255, 244, 214, 1)');
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = cell * 0.08;
      ctx.beginPath();
      ctx.moveTo(fx + dx * tail, fy + dy * tail);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.fillStyle = '#5a4e40';
      ctx.beginPath();
      ctx.arc(fx, fy, cell * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const since = now - meteor.at;
  if (since > 900) return;
  const t = since / 900;
  // Flash.
  if (since < 250) {
    const f = 1 - since / 250;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, cell * 2.2);
    glow.addColorStop(0, `rgba(255, 250, 230, ${0.9 * f})`);
    glow.addColorStop(1, 'rgba(255, 250, 230, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - cell * 2.2, y - cell * 2.2, cell * 4.4, cell * 4.4);
  }
  // Dust ring.
  ctx.strokeStyle = `rgba(230, 225, 215, ${0.7 * (1 - t)})`;
  ctx.lineWidth = cell * 0.12 * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(x, y, cell * (0.3 + 2.2 * t), cell * (0.2 + 1.5 * t), 0, 0, Math.PI * 2);
  ctx.stroke();
  // Rocks flying out on arcs and settling.
  ctx.fillStyle = `rgba(90, 78, 64, ${1 - t * t})`;
  for (const { a, v, r } of style.rocks) {
    const d = cell * v * t, rise = cell * 1.4 * v * t * (1 - t) * 0.6;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - rise, cell * 0.05 * r * (1.2 - t), 0, Math.PI * 2);
    ctx.fill();
  }
}

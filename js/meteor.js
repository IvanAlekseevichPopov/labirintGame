// The meteor event on screen: a shadow growing on the target cell while it falls, the streak,
// the flash, a ring of dust and flying rocks, and a short shake of the whole picture. The crater
// it leaves is a landmark (landmarks.js: impact) drawn into the maze layer.

import { METEOR } from './config.js';

const clamp01 = v => Math.max(0, Math.min(1, v));

// Offset to translate the whole frame by, px; zero when nothing is shaking.
export function meteorShake(meteor, now, cell) {
  if (meteor?.phase !== 'fallen') return [0, 0];
  const t = (now - meteor.at) / METEOR.shakeMs;
  if (t < 0 || t >= 1) return [0, 0];
  const amp = cell * 0.05 * (1 - t);
  return [Math.sin(now / 11) * amp, Math.cos(now / 13) * amp];
}

// Drawn after the rover, before any veil. `toPx` maps a cell to its centre.
export function drawMeteor(ctx, meteor, now, cell, toPx) {
  if (!meteor || meteor.phase === 'waiting') return;
  const [x, y] = toPx(meteor.cell);
  if (meteor.phase === 'falling') {
    const t = clamp01(1 - (meteor.at - now) / METEOR.warnMs);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.4 * t})`;
    ctx.beginPath();
    ctx.ellipse(x, y, cell * (0.15 + 0.3 * t), cell * (0.1 + 0.2 * t), 0, 0, Math.PI * 2);
    ctx.fill();
    // The rock itself shows for the last third of the fall, coming in from the upper right.
    if (t > 0.66) {
      const f = (t - 0.66) / 0.34;
      const fx = x + (1 - f) * cell * 6, fy = y - (1 - f) * cell * 9;
      const grad = ctx.createLinearGradient(fx + cell * 1.2, fy - cell * 1.8, fx, fy);
      grad.addColorStop(0, 'rgba(255, 240, 200, 0)');
      grad.addColorStop(1, 'rgba(255, 244, 214, 1)');
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = cell * 0.08;
      ctx.beginPath();
      ctx.moveTo(fx + cell * 1.2, fy - cell * 1.8);
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
  for (let k = 0; k < 14; k++) {
    const a = k * 0.45 + 0.2, v = 1.2 + (k % 4) * 0.5;
    const d = cell * v * t, rise = cell * 1.4 * v * t * (1 - t) * 0.6;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - rise, cell * 0.05 * (1.2 - t), 0, Math.PI * 2);
    ctx.fill();
  }
}

// The start screen's scene: the rover of the next level in profile on top of its planet, the
// globe turning under it so it looks like the rover drives round it. Before a night level the
// globe is lit from below and the rover drives on the dark side with its lights on.

import { drawGlobe } from './art.js';
import { drawProfile } from './profiles.js';

// Milliseconds per radian of the globe's turn.
const TURN_MS = 1600;

// Lamps in profile space (wheels on y = 0, facing right, 1 = rover length).
const LIGHTS = {
  lunokhod: { front: [[0.42, -0.34], [0.42, -0.26]], rear: [[-0.44, -0.3]] },
  marsRover: { front: [[0.29, -0.44], [0.29, -0.36]], rear: [[-0.33, -0.36]] },
  icebreaker: { front: [[0.3, -0.27]], rear: [[-0.37, -0.36]] },
};

const BEAM = { length: 1.3, spread: 0.13, dip: 0.12, color: '255,236,170' };

const shade = document.createElement('canvas');

export function drawTitleScene(ctx, now, { cx, cy, radius, size, planet, p, night }) {
  const turn = -now / TURN_MS;
  drawGlobe(cx, cy, radius, planet, p, { turn, night, shadow: true });
  const groundY = cy - radius;
  const rolled = (now / TURN_MS) * radius / size;
  if (!night) {
    drawProfile(ctx, p.rover, cx, groundY, size, { rolled, spokes: 1, ground: radius });
    return;
  }

  // Lit only by the stars: drawn apart and dimmed, so the globe under it stays as it is.
  const dpr = devicePixelRatio || 1;
  const box = { x: cx - size, y: groundY - size, w: size * 2, h: size * 1.2 };
  const pw = Math.ceil(box.w * dpr), ph = Math.ceil(box.h * dpr);
  // A zero-sized canvas makes drawImage throw, which would put up the error screen.
  if (!pw || !ph) return;
  if (shade.width !== pw || shade.height !== ph) {
    shade.width = pw;
    shade.height = ph;
  }
  const g = shade.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, pw, ph);
  g.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
  drawProfile(g, p.rover, cx, groundY, size, { rolled, spokes: 1, ground: radius });
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(4, 6, 20, 0.5)';
  g.fillRect(box.x, box.y, box.w, box.h);
  ctx.drawImage(shade, box.x, box.y, box.w, box.h);

  // A rover not in LIGHTS yet still drives dimmed, only without lamps.
  const lights = LIGHTS[p.rover];
  if (!lights) return;
  const at = ([x, y]) => [cx + x * size, groundY + y * size];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  beam(ctx, lights.front.map(at), size);
  ctx.restore();
  for (const lamp of lights.front) glow(ctx, ...at(lamp), size * 0.07, '255,243,176');
  for (const lamp of lights.rear) glow(ctx, ...at(lamp), size * 0.04, '255,59,48');
}

// One cone for both lamps: it starts as wide as the pair and opens out from there.
function beam(ctx, lamps, size) {
  const ys = lamps.map(([, y]) => y);
  const x = lamps[0][0], top = Math.min(...ys), bottom = Math.max(...ys), mid = (top + bottom) / 2;
  const len = size * BEAM.length, a = BEAM.dip;
  const end = (side, from) => [x + Math.cos(a + side * BEAM.spread) * len, from + Math.sin(a + side * BEAM.spread) * len];
  const grad = ctx.createLinearGradient(x, mid, x + Math.cos(a) * len, mid + Math.sin(a) * len);
  grad.addColorStop(0, `rgba(${BEAM.color},0.45)`);
  grad.addColorStop(1, `rgba(${BEAM.color},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(...end(-1, top));
  ctx.lineTo(...end(1, bottom));
  ctx.lineTo(x, bottom);
  ctx.closePath();
  ctx.fill();
}

function glow(ctx, x, y, r, rgb) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.3, `rgba(${rgb},0.8)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
}

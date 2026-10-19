// The start screen's scene: the rover of the next level in profile on top of its planet, the
// globe turning under it so it looks like the rover drives round it. Before a night level the
// globe is lit from below and the rover drives on the dark side with its lights on. A planet with
// its ocean under the ice is shown cut open instead, the drone swimming in it over the turning core;
// before a night under the ice the cut is dimmed, the drone's lamp brighter and now and then a
// sonar ring spreads from it.

import { crack, drawGlobe } from './art.js';
import { drawBeam, drawProfile } from './profiles.js';
import { ROVERS } from './rovers.js';
import { mulberry32 } from './random.js';

// Milliseconds per radian of the globe's turn.
const TURN_MS = 1600;

const BEAM = { length: 1.3, spread: 0.13, dip: 0.12, color: '255,236,170' };

const shade = document.createElement('canvas');

export function drawTitleScene(ctx, now, { cx, cy, radius, size, planet, p, night }) {
  if (p.side) {
    drawCutaway(ctx, now, { cx, cy, radius, p, night });
    return;
  }
  const turn = -now / TURN_MS;
  drawGlobe(cx, cy, radius, planet, p, { turn, night, shadow: true });
  const groundY = cy - radius;
  const rolled = (now / TURN_MS) * radius / size;
  if (!night) {
    drawProfile(ctx, ROVERS[p.rover].profile, cx, groundY, size, { rolled, spokes: 1, ground: radius });
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
  drawProfile(g, ROVERS[p.rover].profile, cx, groundY, size, { rolled, spokes: 1, ground: radius });
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(4, 6, 20, 0.5)';
  g.fillRect(box.x, box.y, box.w, box.h);
  ctx.drawImage(shade, box.x, box.y, box.w, box.h);

  // A rover without lamps in rovers.js still drives dimmed, only without them.
  const lights = ROVERS[p.rover].lamps;
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

// Shell, ocean and core radii in globe radii; the drone swims in the ocean over the core.
const CUT = { ocean: 0.88, core: 0.42, swim: 0.65, drone: 0.3 };
// The shell's outline and its cracks, both in [angle, radius]: they turn with the globe, so the
// turning shows. Made once from a fixed seed, so the planet is always the same.
const SURFACE_STEPS = 240;
const { surface: SURFACE, cracks: SHELL_CRACKS } = shapeShell(mulberry32(41));

// Ranges of ice mountains of uneven heights, each peak leaning its own way, with plains between;
// cracks of all lengths, some right through, some only from the surface or from the ocean, a few
// with a branch.
function shapeShell(rand) {
  const lift = new Array(SURFACE_STEPS).fill(0);
  for (let range = 0; range < 6; range++) {
    const centre = (range + rand() * 0.6) / 6 * Math.PI * 2, spread = 0.08 + rand() * 0.25;
    for (let n = 0, peaks = 1 + Math.floor(rand() * 4); n < peaks; n++) {
      const at = centre + (rand() - 0.5) * spread * 2, height = 0.02 + rand() * 0.08;
      const left = 0.03 + rand() * 0.08, right = 0.03 + rand() * 0.08;
      for (let k = 0; k < SURFACE_STEPS; k++) {
        const a = (k / SURFACE_STEPS) * Math.PI * 2, d = Math.atan2(Math.sin(a - at), Math.cos(a - at));
        const slope = d < 0 ? left : right;
        lift[k] = Math.max(lift[k], height * Math.max(0, 1 - Math.abs(d) / slope) ** 1.3);
      }
    }
  }
  const surface = lift.map((h, k) => [(k / SURFACE_STEPS) * Math.PI * 2, 1 + h + (rand() - 0.5) * 0.008]);
  const cracks = [];
  for (let n = 0; n < 11; n++) {
    const a = (n + rand() * 0.7) / 11 * Math.PI * 2, kind = rand();
    const [from, to] = kind < 0.4 ? [CUT.ocean, 1.01] : kind < 0.75 ? [1.01, 1.01 - (0.3 + rand() * 0.5) * (1 - CUT.ocean)] : [CUT.ocean, CUT.ocean + (0.3 + rand() * 0.4) * (1 - CUT.ocean)];
    const width = 0.008 + rand() * 0.012;
    const pts = crack([[a, from], [a + (rand() - 0.5) * 0.06, to]], rand, 3);
    cracks.push({ pts, width });
    if (rand() < 0.35) {
      const [ba, br] = pts[2 + Math.floor(rand() * (pts.length - 4))];
      cracks.push({ pts: crack([[ba, br], [ba + (rand() < 0.5 ? -1 : 1) * (0.05 + rand() * 0.06), br + (rand() - 0.5) * 0.04]], rand, 2), width: width * 0.6 });
    }
  }
  return { surface, cracks };
}

function drawCutaway(ctx, now, { cx, cy, radius, p, night }) {
  const turn = -now / TURN_MS;
  const at = (a, r) => [cx + Math.cos(a + turn) * r * radius, cy + Math.sin(a + turn) * r * radius];
  const disc = (r, fill) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const shell = () => {
    ctx.beginPath();
    for (const [a, r] of SURFACE) ctx.lineTo(...at(a, r));
    ctx.closePath();
  };
  shell();
  ctx.fillStyle = p.globe;
  ctx.fill();
  ctx.save();
  shell();
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70, 140, 185, 0.75)';
  for (const { pts, width } of SHELL_CRACKS) {
    ctx.beginPath();
    for (const [a, r] of pts) ctx.lineTo(...at(a, r));
    ctx.lineWidth = radius * width;
    ctx.stroke();
  }
  // Lit from the top left, like the other globes; the light stays put while the globe turns.
  const light = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.45, radius * 0.1, cx - radius * 0.15, cy - radius * 0.15, radius * 1.3);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  light.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  light.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = light;
  ctx.fillRect(cx - radius * 1.2, cy - radius * 1.2, radius * 2.4, radius * 2.4);
  ctx.restore();
  shell();
  ctx.lineWidth = radius * 0.025;
  ctx.strokeStyle = p.wallBase;
  ctx.stroke();

  const ocean = ctx.createRadialGradient(cx, cy, radius * CUT.core, cx, cy, radius * CUT.ocean);
  ocean.addColorStop(0, p.water[2]);
  ocean.addColorStop(1, p.water[0]);
  disc(CUT.ocean, ocean);
  disc(CUT.core, '#4b4440');
  for (const [a, d, r] of [[0.9, 0.22, 0.12], [2.9, 0.2, 0.1], [4.6, 0.25, 0.08]]) {
    ctx.beginPath();
    ctx.arc(...at(a, d), r * radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();
  }

  // The drone keeps to the top, swimming on the spot while the planet turns under it.
  const size = radius * CUT.drone;
  const droneY = cy - radius * CUT.swim + Math.sin(now / 700) * size * 0.04;
  if (night) drawCutawayNight(ctx, now, { cx, cy, radius, shell, droneY, size });
  ctx.save();
  ctx.translate(cx, droneY);
  // At night the lamp shines twice as bright.
  for (let k = night ? 2 : 1; k > 0; k--) drawBeam(ctx, ROVERS[p.rover].beam, size * 0.06, size * 0.3, size);
  drawProfile(ctx, ROVERS[p.rover].profile, size * 0.06, size * 0.3, size, { rolled: now / 300 });
  ctx.restore();
}

const NIGHT_SONAR_MS = 6000;

// Night under the ice: dimmed, never black, so the planet still reads from the sofa; a glow round
// the drone and a sonar ring spreading from it through the ocean every NIGHT_SONAR_MS.
function drawCutawayNight(ctx, now, { cx, cy, radius, shell, droneY, size }) {
  ctx.save();
  shell();
  ctx.fillStyle = 'rgba(2, 5, 14, 0.3)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * CUT.ocean, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2, 5, 14, 0.4)';
  ctx.fill();
  // Only the water, not the ice round it or the core in it.
  ctx.arc(cx, cy, radius * CUT.core, 0, Math.PI * 2);
  ctx.clip('evenodd');
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, cx, droneY, size * 0.3, '60, 90, 120');
  const t = (now % NIGHT_SONAR_MS) / 1500;
  if (t < 1) {
    ctx.strokeStyle = `rgba(110, 250, 225, ${(0.6 * (1 - t)).toFixed(3)})`;
    ctx.lineWidth = radius * 0.012;
    ctx.beginPath();
    ctx.arc(cx, droneY, radius * 0.8 * t, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

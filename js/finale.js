// The finale: the three rovers retired to a museum hall, seen from the side like exhibits — each
// on its pedestal under a spotlight, a plaque with its planet, its planet's picture with a medal on
// the wall above, a velvet rope in front. Calm on purpose: the rovers rest, only dust drifts in the
// light and a medal glints now and then.

import { FONT, OUTLINE, drawGlobe } from './art.js';
import { drawProfile } from './profiles.js';
import { PLANETS, PLANET_KEYS } from './planets.js';

let c;
// Where the wall meets the floor, as a share of the screen height.
const FLOOR = 0.76;

// Leaves room above for the title and below for the button.
export function drawMuseum(context, now, w, h) {
  c = context;
  hall(w, h);
  const spacing = Math.min(w * 0.9 / PLANET_KEYS.length, h * 0.6);
  const size = Math.min(spacing * 0.72, h * 0.24);
  const top = h * 0.63;
  PLANET_KEYS.forEach((planet, i) => {
    const x = w / 2 + (i - (PLANET_KEYS.length - 1) / 2) * spacing;
    // The picture hangs clear of the exhibit: even the Mars rover's mast stays below its frame.
    painting(x, h * 0.31, size * 0.95, h * 0.13, planet, h, now, i);
    spotlight(x, top, size, h, now, i);
    pedestal(x, top, size, h);
    // Engraved, so plain dark letters: the outlined game text looks blurry on brass.
    c.font = `${h * 0.032}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#4a3208';
    c.fillText(PLANETS[planet].name, x, top + h * 0.077);
    c.beginPath();
    c.ellipse(x, top, size * 0.45, size * 0.025, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 0, 0, 0.25)';
    c.fill();
    drawProfile(c, PLANETS[planet].rover, x, top, size);
  });
  rope(w, h, spacing);
}

// On the wall above each exhibit, a framed picture of the planet it worked on: the globe from the
// start screen against a starry sky, on a cream mat in a gilt frame, a medal hung on its corner.
function painting(x, cy, pw, ph, planet, h, now, i) {
  const left = x - pw / 2, top = cy - ph / 2, frame = h * 0.012, mat = frame * 0.6;
  c.fillStyle = 'rgba(0, 0, 0, 0.4)';
  c.fillRect(left - frame + frame * 2, top - frame + frame * 2, pw + frame * 2, ph + frame * 2);
  c.strokeStyle = OUTLINE;
  c.lineWidth = h * 0.003;
  c.beginPath();
  c.rect(left - frame, top - frame, pw + frame * 2, ph + frame * 2);
  c.fillStyle = '#c9972e';
  c.fill();
  c.stroke();
  c.fillStyle = '#f3ead6';
  c.fillRect(left, top, pw, ph);
  c.beginPath();
  c.rect(left + mat, top + mat, pw - mat * 2, ph - mat * 2);
  const sky = c.createLinearGradient(0, top, 0, top + ph);
  sky.addColorStop(0, '#16205a');
  sky.addColorStop(1, '#2c3a7a');
  c.fillStyle = sky;
  c.fill();
  c.stroke();
  c.save();
  c.clip();
  c.fillStyle = '#ffffff';
  for (let k = 0; k < 14; k++) {
    c.globalAlpha = 0.4 + (k % 3) * 0.2;
    c.fillRect(left + ((k * 0.37 + 0.11) % 1) * pw, top + ((k * 0.61 + 0.23) % 1) * ph, h * 0.002, h * 0.002);
  }
  c.globalAlpha = 1;
  drawGlobe(x, cy, ph * 0.34, planet, PLANETS[planet]);
  c.restore();
  medal(left + pw + frame * 0.3, top + ph * 0.15, h, now, i);
}

// A gold medal on a red ribbon, with a slow glint crossing it every few seconds.
function medal(x, y, h, now, i) {
  const r = h * 0.022;
  c.strokeStyle = OUTLINE;
  c.lineWidth = h * 0.003;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + side * r * 0.2, y - r * 1.8);
    c.lineTo(x + side * r * 0.9, y - r * 1.8);
    c.lineTo(x + side * r * 0.45, y - r * 0.4);
    c.lineTo(x, y - r * 0.4);
    c.closePath();
    c.fillStyle = side < 0 ? '#c62839' : '#a51d2d';
    c.fill();
    c.stroke();
  }
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = '#f2c230';
  c.fill();
  c.stroke();
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2, rr = k % 2 ? r * 0.28 : r * 0.62;
    c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = '#d99a12';
  c.fill();
  const t = ((now / 1000 + i * 0.9) % 2.6) / 2.6;
  if (t < 0.25) {
    const k = Math.sin((t / 0.25) * Math.PI);
    c.globalAlpha = k;
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2, rr = j % 2 ? r * 0.12 : r * 0.7;
      c[j ? 'lineTo' : 'moveTo'](x - r * 0.35 + Math.cos(a) * rr, y - r * 0.35 + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }
}

function hall(w, h) {
  const wall = c.createLinearGradient(0, 0, 0, FLOOR * h);
  wall.addColorStop(0, '#070a1f');
  wall.addColorStop(1, '#1b2147');
  c.fillStyle = wall;
  c.fillRect(0, 0, w, h);
  const floor = c.createLinearGradient(0, FLOOR * h, 0, h);
  floor.addColorStop(0, '#2a2f55');
  floor.addColorStop(1, '#141833');
  c.fillStyle = floor;
  c.fillRect(0, FLOOR * h, w, h);
  c.fillStyle = 'rgba(255, 255, 255, 0.08)';
  c.fillRect(0, FLOOR * h, w, h * 0.004);
}

// A cone of warm light from above, a pool of it on the pedestal, dust motes drifting inside.
// Drawn before the pedestal, so the beam runs down to the floor behind it and leaves a warm pool
// there instead of stopping at the pedestal's top.
function spotlight(x, top, size, h, now, i) {
  const floor = FLOOR * h, half = size * 0.75, foot = half * (floor / top);
  const beam = c.createLinearGradient(0, 0, 0, floor);
  beam.addColorStop(0, 'rgba(255, 236, 180, 0.02)');
  beam.addColorStop(1, 'rgba(255, 236, 180, 0.16)');
  c.beginPath();
  c.moveTo(x - size * 0.12, 0);
  c.lineTo(x + size * 0.12, 0);
  c.lineTo(x + foot, floor);
  c.lineTo(x - foot, floor);
  c.closePath();
  c.fillStyle = beam;
  c.fill();
  const pool = c.createRadialGradient(x, floor, 0, x, floor, foot * 1.2);
  pool.addColorStop(0, 'rgba(255, 236, 180, 0.28)');
  pool.addColorStop(1, 'rgba(255, 236, 180, 0)');
  c.beginPath();
  c.ellipse(x, floor + h * 0.02, foot * 1.2, h * 0.035, 0, 0, Math.PI * 2);
  c.fillStyle = pool;
  c.fill();
  c.fillStyle = 'rgba(255, 240, 200, 0.7)';
  for (let k = 0; k < 6; k++) {
    const t = (now / 9000 + k / 6 + i * 0.37) % 1;
    const y = top * (0.15 + 0.8 * t);
    const spread = size * 0.12 + (half - size * 0.12) * (y / top);
    c.globalAlpha = Math.sin(t * Math.PI) * 0.6;
    c.beginPath();
    c.arc(x + Math.sin(k * 2.3 + now / 1500) * spread * 0.7, y, h * 0.0025, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

function pedestal(x, top, size, h) {
  const pw = size * 1.25, ph = FLOOR * h - top;
  const side = c.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
  side.addColorStop(0, '#d8dbe4');
  side.addColorStop(0.45, '#f4f5f8');
  side.addColorStop(1, '#9ea3b3');
  c.strokeStyle = OUTLINE;
  c.lineWidth = h * 0.004;
  c.beginPath();
  c.rect(x - pw / 2, top, pw, ph);
  c.fillStyle = side;
  c.fill();
  c.stroke();
  // A cap on top and a plinth at the foot, a little wider than the column.
  c.beginPath();
  c.rect(x - pw / 2 - h * 0.01, top - h * 0.012, pw + h * 0.02, h * 0.016);
  c.fillStyle = '#ffffff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.rect(x - pw / 2 - h * 0.012, top + ph - h * 0.02, pw + h * 0.024, h * 0.02);
  c.fillStyle = '#b9bdcb';
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(x, top - h * 0.004, size * 0.55, h * 0.008, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255, 236, 180, 0.35)';
  c.fill();
  // The plaque: a small brass plate on the front.
  c.beginPath();
  c.roundRect(x - pw * 0.32, top + h * 0.05, pw * 0.64, h * 0.05, h * 0.008);
  c.fillStyle = '#d4a53a';
  c.fill();
  c.stroke();
}

// A velvet rope on brass posts across the front, sagging between them.
function rope(w, h, spacing) {
  const y = h * 0.8, n = PLANET_KEYS.length;
  const posts = Array.from({ length: n + 1 }, (_, k) => w / 2 + (k - n / 2) * spacing);
  c.lineCap = 'round';
  c.strokeStyle = '#8f1d2c';
  c.lineWidth = h * 0.012;
  for (let k = 0; k < posts.length - 1; k++) {
    c.beginPath();
    c.moveTo(posts[k], y);
    c.quadraticCurveTo((posts[k] + posts[k + 1]) / 2, y + h * 0.05, posts[k + 1], y);
    c.stroke();
  }
  for (const x of posts) {
    c.fillStyle = '#c9972e';
    c.strokeStyle = OUTLINE;
    c.lineWidth = h * 0.003;
    c.beginPath();
    c.roundRect(x - h * 0.006, y, h * 0.012, h * 0.06, h * 0.004);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(x, y - h * 0.004, h * 0.013, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(x, y + h * 0.06, h * 0.025, h * 0.007, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

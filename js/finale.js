// The finale: the three rovers retired to a museum hall, seen from the side like exhibits — each
// on its pedestal under a spotlight, a plaque with its planet, its planet's picture with a medal on
// the wall above, a velvet rope in front. Calm on purpose: the rovers rest, only dust drifts in the
// light and a medal glints now and then.

import { FONT, OUTLINE, drawGlobe } from './art.js';
import { PLANETS, PLANET_KEYS } from './planets.js';

let c;
// Where the wall meets the floor, as a share of the screen height.
const FLOOR = 0.76;

// Leaves room above for the title and below for the button.
export function drawMuseum(context, now, w, h) {
  c = context;
  hall(w, h);
  const spacing = Math.min(w * 0.3, h * 0.6);
  const size = Math.min(spacing * 0.72, h * 0.24);
  const top = h * 0.63;
  PLANET_KEYS.forEach((planet, i) => {
    const x = w / 2 + (i - 1) * spacing;
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
    c.save();
    c.translate(x, top);
    c.scale(size, size);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = OUTLINE;
    c.lineWidth = 0.025;
    c.beginPath();
    c.ellipse(0, 0, 0.45, 0.025, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 0, 0, 0.25)';
    c.fill();
    EXHIBITS[PLANETS[planet].rover]();
    c.restore();
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
  const y = h * 0.8, posts = [-1.5, -0.5, 0.5, 1.5].map(k => w / 2 + k * spacing);
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

function box(x, y, w, h, r, fill) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  c.stroke();
}

function wheel(x, y, r, tyre, hub) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = tyre;
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(x, y, r * 0.45, 0, Math.PI * 2);
  c.fillStyle = hub;
  c.fill();
  c.stroke();
}

function spokedWheel(x, y, r, tyre, hub) {
  wheel(x, y, r, tyre, hub);
  c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  c.lineWidth = r * 0.12;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    c.beginPath();
    c.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8);
    c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
    c.stroke();
  }
  c.strokeStyle = OUTLINE;
  c.lineWidth = 0.025;
}

function dot(x, y, r, fill) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  c.stroke();
}

// A thin panel line.
function seam(x0, y0, x1, y1, color = 'rgba(0, 0, 0, 0.25)') {
  c.save();
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = color;
  c.lineWidth = 0.012;
  c.stroke();
  c.restore();
}

function bar(x0, y0, x1, y1, color, width) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineWidth = width + 0.03;
  c.strokeStyle = OUTLINE;
  c.stroke();
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
  c.lineWidth = 0.025;
  c.strokeStyle = OUTLINE;
}

// The same three rovers as in play, now from the side; unit space, wheels on y = 0, facing right.
const EXHIBITS = {
  // A silver tub on eight wheels (four seen), its blue solar lid swung open, headlights and
  // camera eyes at the front, a whip antenna.
  lunokhod() {
    for (const x of [-0.33, -0.11, 0.11, 0.33]) spokedWheel(x, -0.09, 0.09, '#2b2d33', '#8d939e');
    box(-0.44, -0.42, 0.88, 0.26, 0.1, '#d5d9e0');
    c.fillStyle = '#aeb3bd';
    c.fillRect(-0.42, -0.24, 0.84, 0.05);
    seam(-0.4, -0.33, 0.4, -0.33);
    c.save();
    c.translate(-0.38, -0.42);
    c.rotate(-0.55);
    box(0, -0.035, 0.62, 0.07, 0.02, '#2f6fd6');
    for (const t of [0.15, 0.3, 0.45]) seam(t, -0.03, t, 0.03, 'rgba(160, 200, 255, 0.8)');
    c.restore();
    for (const y of [-0.34, -0.26]) dot(0.4, y, 0.032, '#ffd60a');
    for (const x of [0.22, 0.3]) dot(x, -0.37, 0.02, '#1d3557');
    bar(0.24, -0.42, 0.28, -0.66, '#9aa1ad', 0.012);
    dot(0.28, -0.67, 0.02, '#9aa1ad');
  },
  // A cream box on rocker legs and six wheels (three seen), a camera mast up front, a dish, the
  // finned power unit at the back and an arm folded under the nose.
  marsRover() {
    bar(-0.34, -0.1, -0.05, -0.32, '#7a7670', 0.035);
    bar(0.34, -0.1, 0.05, -0.32, '#7a7670', 0.035);
    bar(0, -0.1, 0, -0.32, '#7a7670', 0.035);
    for (const x of [-0.34, 0, 0.34]) spokedWheel(x, -0.1, 0.1, '#33302c', '#9a958c');
    c.save();
    c.translate(-0.38, -0.5);
    c.rotate(-0.5);
    box(-0.05, -0.08, 0.12, 0.2, 0.03, '#6f6a62');
    for (const t of [-0.04, 0.02, 0.08]) seam(-0.08, t, 0.1, t, '#4a463f');
    c.restore();
    box(-0.32, -0.5, 0.6, 0.2, 0.04, '#ece6da');
    c.fillStyle = '#c9bfae';
    c.fillRect(-0.28, -0.43, 0.3, 0.08);
    seam(0.06, -0.48, 0.06, -0.32);
    bar(0.28, -0.34, 0.4, -0.26, '#7a7670', 0.02);
    bar(0.4, -0.26, 0.36, -0.18, '#7a7670', 0.02);
    bar(0.2, -0.5, 0.2, -0.82, '#7a7670', 0.03);
    box(0.12, -0.92, 0.2, 0.1, 0.02, '#fafafa');
    for (const x of [0.25, 0.3]) dot(x, -0.87, 0.018, '#1d4ed8');
    c.beginPath();
    c.ellipse(-0.18, -0.56, 0.09, 0.035, -0.4, 0, Math.PI * 2);
    c.fillStyle = '#d8d3c8';
    c.fill();
    c.stroke();
  },
  // An orange cab on long tracks, the ice drill out in front, lights on the roof.
  icebreaker() {
    box(-0.44, -0.2, 0.82, 0.2, 0.1, '#2b2d33');
    c.strokeStyle = '#5b5f6b';
    c.lineWidth = 0.015;
    for (let x = -0.38; x <= 0.32; x += 0.07) {
      c.beginPath();
      c.moveTo(x, -0.2);
      c.lineTo(x, -0.17);
      c.moveTo(x, -0.03);
      c.lineTo(x, 0);
      c.stroke();
    }
    c.strokeStyle = OUTLINE;
    c.lineWidth = 0.025;
    for (const x of [-0.32, -0.12, 0.08, 0.26]) spokedWheel(x, -0.1, 0.06, '#5b5f6b', '#2b2d33');
    c.beginPath();
    c.moveTo(0.3, -0.38);
    c.lineTo(0.62, -0.3);
    c.lineTo(0.3, -0.22);
    c.closePath();
    c.fillStyle = '#c3c8d1';
    c.fill();
    c.stroke();
    for (const x of [0.38, 0.46, 0.54]) bar(x, -0.36 + (x - 0.38) * 0.2, x + 0.03, -0.24 - (x - 0.38) * 0.2, '#8d939e', 0.006);
    box(-0.36, -0.52, 0.68, 0.32, 0.06, '#ff7a1a');
    c.fillStyle = '#e0600c';
    c.fillRect(-0.34, -0.3, 0.64, 0.05);
    box(0.08, -0.48, 0.18, 0.13, 0.03, '#1d3557');
    seam(0.12, -0.46, 0.16, -0.38, 'rgba(160, 200, 255, 0.8)');
    dot(0.27, -0.27, 0.03, '#ffd60a');
    box(-0.2, -0.57, 0.3, 0.05, 0.02, '#4a4d57');
    for (const x of [-0.14, -0.05, 0.04]) dot(x, -0.545, 0.016, '#ffd60a');
    bar(-0.3, -0.52, -0.3, -0.64, '#4a4d57', 0.03);
    c.fillStyle = '#7a3a10';
    c.fillRect(-0.3, -0.46, 0.06, 0.12);
  },
};

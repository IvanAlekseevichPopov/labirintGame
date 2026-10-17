// The three rovers from the side, as in the finale's museum and on the start screen: the same
// machines as in play, seen in profile, facing right.

import { OUTLINE } from './art.js';

let c;
let travel = 0;
let spokes = 3;
let groundR = 0;
// How far the ground has dropped below the rover's middle at x, on a ball of radius groundR (0 is
// flat ground): wheels on their own suspension follow it, so none hangs in the air.
const sag = x => (groundR ? groundR - Math.sqrt(groundR * groundR - x * x) : 0);

// Wheels touch the ground at (x, groundY); `size` is the rover's length. `rolled` is how far it
// has driven, in its own lengths, to turn the wheels; small rovers read better with fewer `spokes`.
// `ground` is the radius of the ball it stands on, 0 for flat ground.
export function drawProfile(context, type, x, groundY, size, options) {
  drawIn(context, PROFILES[type], x, groundY, size, options);
}

// Head-on, for the moment a machine turns round between facing left and right; same space.
export function drawFront(context, type, x, groundY, size) {
  drawIn(context, FRONTS[type], x, groundY, size);
}

// The drone's bow lamp (see PROFILES.drone) and its beam, in the same space as drawProfile(): it
// shows which way the drone faces and that it is deep under water. Faint, so it never reads as a
// wall or a path.
const LAMP = { x: 0.3, y: -0.15, length: 1.4, spread: 0.2, dip: 0.12, alpha: 0.32 };

export function drawDroneBeam(context, x, groundY, size) {
  const lx = x + LAMP.x * size, ly = groundY + LAMP.y * size, len = size * LAMP.length;
  const end = side => [lx + Math.cos(LAMP.dip + side * LAMP.spread) * len, ly + Math.sin(LAMP.dip + side * LAMP.spread) * len];
  const glow = context.createLinearGradient(lx, ly, lx + Math.cos(LAMP.dip) * len, ly + Math.sin(LAMP.dip) * len);
  glow.addColorStop(0, `rgba(255, 243, 190, ${LAMP.alpha})`);
  glow.addColorStop(1, 'rgba(255, 243, 190, 0)');
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = glow;
  context.beginPath();
  context.moveTo(lx, ly - size * 0.02);
  context.lineTo(...end(-1));
  context.lineTo(...end(1));
  context.lineTo(lx, ly + size * 0.02);
  context.closePath();
  context.fill();
  context.restore();
}

function drawIn(context, draw, x, groundY, size, { rolled = 0, spokes: count = 3, ground = 0 } = {}) {
  c = context;
  travel = rolled;
  spokes = count;
  groundR = ground / size;
  c.save();
  c.translate(x, groundY);
  c.scale(size, size);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = OUTLINE;
  c.lineWidth = 0.025;
  draw();
  c.restore();
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

// Spokes turned by how far the rover has rolled, so wheels of any size roll at the same speed.
function spokedWheel(x, y, r, tyre, hub) {
  wheel(x, y, r, tyre, hub);
  c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  c.lineWidth = r * 0.12;
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI + travel / r;
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

const PROFILES = {
  // A silver tub on eight wheels (four seen), its blue solar lid swung open, headlights and
  // camera eyes at the front, a whip antenna.
  lunokhod() {
    for (const x of [-0.33, -0.11, 0.11, 0.33]) spokedWheel(x, -0.09 + sag(x), 0.09, '#2b2d33', '#8d939e');
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
    bar(-0.34, -0.1 + sag(-0.34), -0.05, -0.32, '#7a7670', 0.035);
    bar(0.34, -0.1 + sag(0.34), 0.05, -0.32, '#7a7670', 0.035);
    bar(0, -0.1, 0, -0.32, '#7a7670', 0.035);
    for (const x of [-0.34, 0, 0.34]) spokedWheel(x, -0.1 + sag(x), 0.1, '#33302c', '#9a958c');
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
  // A short yellow submarine: a round-ended hull on a little skid, a big glass porthole with a
  // camera eye at the bow, a conning tower with a periscope, a ducted propeller turned by `rolled`.
  // Short on purpose: it has to fit a vertical shaft, where it swims sideways on.
  drone() {
    for (const x of [-0.1, 0.1]) bar(x, -0.1, x, -0.035, '#5b6573', 0.025);
    bar(-0.16, -0.03, 0.16, -0.03, '#5b6573', 0.03);
    const blade = 0.12 * Math.cos(travel * 9);
    bar(-0.47, -0.27 - blade, -0.47, -0.27 + blade, '#c3c8d1', 0.03);
    c.beginPath();
    c.moveTo(-0.44, -0.35);
    c.lineTo(-0.3, -0.39);
    c.lineTo(-0.3, -0.15);
    c.lineTo(-0.44, -0.19);
    c.closePath();
    c.fillStyle = '#4a5563';
    c.fill();
    c.stroke();
    bar(0.08, -0.56, 0.08, -0.68, '#5b6573', 0.025);
    bar(0.08, -0.68, 0.15, -0.68, '#5b6573', 0.025);
    box(-0.12, -0.6, 0.26, 0.18, 0.06, '#ffb81c');
    dot(-0.05, -0.63, 0.025, '#ff5a4e');
    box(-0.34, -0.46, 0.7, 0.38, 0.19, '#ffc83d');
    c.save();
    c.beginPath();
    c.roundRect(-0.34, -0.46, 0.7, 0.38, 0.19);
    c.clip();
    c.fillStyle = '#e39a12';
    c.fillRect(-0.34, -0.17, 0.7, 0.09);
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.fillRect(-0.22, -0.43, 0.34, 0.035);
    c.restore();
    dot(-0.15, -0.28, 0.065, '#8fe3ff');
    dot(0.16, -0.28, 0.13, '#8fe3ff');
    dot(0.2, -0.28, 0.045, '#1d3557');
    seam(0.09, -0.35, 0.15, -0.38, 'rgba(255, 255, 255, 0.85)');
    dot(0.3, -0.15, 0.03, '#fff3b0');
  },
};

const FRONTS = {
  // The submarine end-on: the round hull with the big porthole looking straight out, the tower on
  // top and the skid below.
  drone() {
    for (const x of [-0.08, 0.08]) bar(x, -0.1, x * 1.3, -0.035, '#5b6573', 0.025);
    bar(-0.15, -0.03, 0.15, -0.03, '#5b6573', 0.03);
    bar(0.04, -0.56, 0.04, -0.68, '#5b6573', 0.025);
    dot(0.04, -0.69, 0.025, '#5b6573');
    box(-0.08, -0.6, 0.16, 0.18, 0.05, '#ffb81c');
    dot(-0.03, -0.63, 0.025, '#ff5a4e');
    c.beginPath();
    c.arc(0, -0.27, 0.19, 0, Math.PI * 2);
    c.fillStyle = '#ffc83d';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#e39a12';
    c.fillRect(-0.2, -0.17, 0.4, 0.1);
    c.restore();
    c.stroke();
    dot(0, -0.29, 0.12, '#8fe3ff');
    dot(0, -0.29, 0.045, '#1d3557');
    seam(-0.07, -0.35, -0.03, -0.38, 'rgba(255, 255, 255, 0.85)');
    dot(0, -0.13, 0.025, '#fff3b0');
  },
};

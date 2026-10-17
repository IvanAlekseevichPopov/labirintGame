// A neighbour in the sky over each planet, so it is clear at a glance where we are: the Earth
// over the Moon, little Phobos and Deimos over Mars, huge banded Jupiter over Europa. It hangs in
// the top right corner; in play the maze covers most of it, so it rises over the maze's far edge.
// Lit from the top left, like everything else.

import { softBlob } from './art.js';
import { drawSprite } from './sprite.js';

// Centre and radius in screen heights; x counts from the right edge.
const NEIGHBOURS = {
  moon: [{ body: earth, x: 0.17, y: 0.12, r: 0.09 }],
  mars: [{ body: phobos, x: 0.2, y: 0.09, r: 0.05 }, { body: deimos, x: 0.36, y: 0.05, r: 0.022 }],
  europa: [{ body: jupiter, x: 0.17, y: -0.02, r: 0.24 }],
  enceladus: [{ body: saturn, x: 0.19, y: 0.085, r: 0.06, reach: 2.4 }],
};

let c;

// Half the sprite's side, in radii: room for the glow and for squashed Phobos; Saturn's rings
// need their own.
const REACH = 1.6;

// A sprite per body, redrawn only when the screen size changes.
export function drawNeighbours(context, planet, w, h) {
  for (const [i, n] of (NEIGHBOURS[planet] ?? []).entries()) {
    const r = n.r * h, side = 2 * (n.reach ?? REACH) * r;
    drawSprite(context, `neighbour|${planet}|${i}`, w - n.x * h - side / 2, n.y * h - side / 2, side, side, g => {
      c = g;
      c.translate(side / 2, side / 2);
      c.scale(r, r);
      n.body();
    });
  }
  c = null;
}

function disc(r, fill) {
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

// Day side to the top left, night side to the bottom right.
function shade(dark = 0.6) {
  const g = c.createRadialGradient(-0.45, -0.45, 0.2, -0.15, -0.15, 1.3);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  g.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(4, 6, 20, ${dark})`);
  disc(1, g);
}

function glow(color) {
  const g = c.createRadialGradient(0, 0, 0.95, 0, 0, 1.2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  disc(1.2, g);
}

function earth() {
  glow('rgba(110, 180, 255, 0.45)');
  c.save();
  c.beginPath();
  c.arc(0, 0, 1, 0, Math.PI * 2);
  c.clip();
  disc(1, '#2f7fd8');
  for (const [x, y, r, k] of [[-0.35, -0.25, 0.4, 1], [0.3, 0.35, 0.3, 2], [0.45, -0.45, 0.2, 3], [-0.3, 0.6, 0.18, 4]]) {
    softBlob(c, x, y, r, '#4caf50', k, 0.25);
  }
  c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  c.lineCap = 'round';
  c.lineWidth = 0.09;
  for (const [x, y, r, a0, a1] of [[-0.2, 0.1, 0.55, 3.6, 4.6], [0.25, -0.05, 0.6, 5.2, 6.1], [0, 0.55, 0.45, 0.3, 1.4]]) {
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.stroke();
  }
  softBlob(c, 0, -1.02, 0.3, '#ffffff', 5, 0.1);
  shade(0.7);
  c.restore();
}

function jupiter() {
  glow('rgba(255, 200, 150, 0.25)');
  c.save();
  c.beginPath();
  c.arc(0, 0, 1, 0, Math.PI * 2);
  c.clip();
  disc(1, '#e9d2ad');
  // Bands across the disc, their edges waving a little.
  for (const [y, hgt, color] of [[-0.75, 0.16, '#c99a6b'], [-0.45, 0.14, '#b77a4e'], [-0.2, 0.1, '#f3e6cc'],
    [0.05, 0.18, '#c4885a'], [0.38, 0.12, '#d9b38a'], [0.62, 0.15, '#b07448']]) {
    c.beginPath();
    c.moveTo(-1.1, y);
    for (let x = -1.1; x <= 1.1; x += 0.1) c.lineTo(x, y + Math.sin(x * 6 + y * 9) * 0.02);
    for (let x = 1.1; x >= -1.1; x -= 0.1) c.lineTo(x, y + hgt + Math.sin(x * 5 + y * 7) * 0.02);
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }
  // The Great Red Spot.
  c.beginPath();
  c.ellipse(0.3, 0.3, 0.17, 0.09, -0.05, 0, Math.PI * 2);
  c.fillStyle = '#c4502e';
  c.fill();
  c.beginPath();
  c.ellipse(0.3, 0.3, 0.1, 0.05, -0.05, 0, Math.PI * 2);
  c.fillStyle = '#d9714a';
  c.fill();
  shade(0.65);
  c.restore();
}

// Tilted rings, their far half behind the ball and their near half in front of it.
function saturn() {
  const rings = half => {
    c.save();
    c.rotate(-0.42);
    c.scale(1, 0.26);
    const from = half ? 0 : Math.PI, to = half ? Math.PI : Math.PI * 2;
    for (const [r, w, color] of [[1.42, 0.22, 'rgba(201, 173, 110, 0.9)'], [1.76, 0.3, 'rgba(232, 213, 163, 0.95)'], [2.1, 0.22, 'rgba(201, 173, 110, 0.85)']]) {
      c.beginPath();
      c.arc(0, 0, r, from, to);
      c.lineWidth = w;
      c.strokeStyle = color;
      c.stroke();
    }
    // The Cassini division, a dark gap between the bright ring and the outer one.
    c.beginPath();
    c.arc(0, 0, 1.94, from, to);
    c.lineWidth = 0.06;
    c.strokeStyle = 'rgba(30, 24, 18, 0.75)';
    c.stroke();
    // The ball's shadow on the rings behind it, away from the light in the top left.
    if (!half) {
      c.beginPath();
      c.arc(0, 0, 1.75, -0.75, -0.2);
      c.lineWidth = 0.85;
      c.strokeStyle = 'rgba(10, 8, 20, 0.55)';
      c.stroke();
    }
    c.restore();
  };
  glow('rgba(255, 220, 160, 0.2)');
  rings(false);
  c.save();
  c.beginPath();
  c.arc(0, 0, 1, 0, Math.PI * 2);
  c.clip();
  disc(1, '#e8d5a3');
  c.rotate(-0.42);
  for (const [y, hgt, color] of [[-0.7, 0.18, '#d9bf86'], [-0.3, 0.12, '#c9ad6e'], [0.1, 0.2, '#dcc58f'], [0.5, 0.14, '#c9ad6e']]) {
    c.fillStyle = color;
    c.fillRect(-1.2, y, 2.4, hgt);
  }
  c.rotate(0.42);
  shade(0.65);
  c.restore();
  rings(true);
}

function moonlet(seed) {
  softBlob(c, 0, 0, 1, '#8c7b6a', seed, 0.18);
  c.save();
  c.clip();
  for (const [x, y, r] of [[-0.3, -0.2, 0.25], [0.35, 0.1, 0.18], [0, 0.45, 0.14]]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(40, 30, 25, 0.35)';
    c.fill();
  }
  shade(0.6);
  c.restore();
}

function phobos() {
  c.scale(1.3, 1);
  moonlet(2);
}

function deimos() {
  moonlet(5);
}

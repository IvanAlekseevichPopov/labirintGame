// The rocket waiting at the goal, one per planet, all the same height so the beacon and the
// flame line up: the classic white-and-red one on the Moon, a white lander with blue trim on
// landing legs on Mars (it has to stand out on red ground), a stout orange one with side boosters
// on Europa's pale ice. Each is a bit worn — panel seams, rivets, soot from earlier launches, a
// few scratches — and carries its planet: grey dust, red sand, or snow on every ledge.
// Unit space: the nozzle at the origin, the nose at y = -1.

import { OUTLINE } from './art.js';
import { drawSprite } from './sprite.js';

let c;

// The sprite's box in unit space, wide enough for the Mars legs and the Europa boosters.
const BOX = { left: -0.5, top: -1.1, w: 1, h: 1.2 };

// `planet` is its palette: `rocket` picks the drawing, `dust` (a colour) or `snow` what lies on it.
// Only the flame is drawn live; the rocket is a sprite.
export function drawRocket(context, cx, baseY, size, flame, now, planet) {
  if (flame) {
    c = context;
    c.save();
    c.translate(cx, baseY);
    c.scale(size, size);
    drawFlame(now);
    c.restore();
  }
  const key = `rocket|${planet.rocket}|${planet.dust ?? ''}|${planet.snow ? 'snow' : ''}`;
  drawSprite(context, key, cx + BOX.left * size, baseY + BOX.top * size, BOX.w * size, BOX.h * size, g => {
    c = g;
    c.scale(size, size);
    c.translate(-BOX.left, -BOX.top);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    // Thick outline: the body has to stand out even on pale ice.
    c.strokeStyle = OUTLINE;
    c.lineWidth = 0.04;
    ROCKETS[planet.rocket ?? 'classic'](planet);
  });
  c = null;
}

function drawFlame(now) {
  const len = 0.45 + 0.08 * Math.sin(now / 30);
  const g = c.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.4, '#ffb703');
  g.addColorStop(1, 'rgba(230, 57, 70, 0)');
  c.beginPath();
  c.moveTo(-0.11, -0.02);
  c.quadraticCurveTo(0, len * 1.1, 0.11, -0.02);
  c.fillStyle = g;
  c.fill();
}

function shape(points) {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

function line(x0, y0, x1, y1, color, width) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

// Paints inside `path` with `paint()`, then outlines it.
function part(path, paint) {
  c.save();
  c.clip(path);
  paint();
  c.restore();
  c.strokeStyle = OUTLINE;
  c.lineWidth = 0.04;
  c.stroke(path);
}

function shaded(x0, x1, light, dark) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.4, light);
  g.addColorStop(1, dark);
  return g;
}

// Grime from the bottom up to `top`: soot from earlier launches, then the planet's dust over it.
function grime(x0, x1, top, planet) {
  const soot = c.createLinearGradient(0, -0.05, 0, top);
  soot.addColorStop(0, 'rgba(40, 32, 30, 0.45)');
  soot.addColorStop(1, 'rgba(40, 32, 30, 0)');
  c.fillStyle = soot;
  c.fillRect(x0, top, x1 - x0, -top);
  if (planet.dust) {
    const dust = c.createLinearGradient(0, -0.05, 0, top);
    dust.addColorStop(0, planet.dust);
    dust.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.globalAlpha = 0.35;
    c.fillStyle = dust;
    c.fillRect(x0, top, x1 - x0, -top);
    c.globalAlpha = 1;
  }
}

// Fixed specks, so the rocket looks the same every frame: dust, or frost when it is snowy.
// Small and low on the hull, below the porthole: dirt, not polka dots.
const SPECKS = [[-0.12, -0.16, 0.008], [0.09, -0.22, 0.006], [-0.03, -0.3, 0.007], [0.13, -0.13, 0.007], [-0.15, -0.27, 0.006]];

function specks(planet) {
  c.fillStyle = planet.snow ? '#ffffff' : planet.dust;
  for (const [x, y, r] of SPECKS) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
}

function scratches() {
  for (const [x0, y0, x1, y1] of [[0.06, -0.43, 0.12, -0.47], [-0.13, -0.58, -0.08, -0.6], [0.1, -0.7, 0.13, -0.68]]) {
    line(x0, y0, x1, y1, 'rgba(0, 0, 0, 0.2)', 0.01);
  }
}

// Seams across the body and rivets along them.
function panels(w, seams) {
  for (const y of seams) {
    line(-w, y, w, y, 'rgba(0, 0, 0, 0.22)', 0.012);
    c.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let x = -w + 0.04; x < w - 0.02; x += 0.065) {
      c.beginPath();
      c.arc(x, y + 0.025, 0.008, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function body(w) {
  const p = new Path2D();
  p.moveTo(-w, -0.1);
  p.lineTo(-w, -0.6);
  p.quadraticCurveTo(-w, -1, 0, -1);
  p.quadraticCurveTo(w, -1, w, -0.6);
  p.lineTo(w, -0.1);
  p.closePath();
  return p;
}

// A bell with a lit rim: wider at the bottom, darker inside.
function nozzle(w) {
  part(shape([[-w * 0.7, -0.12], [w * 0.7, -0.12], [w + 0.03, 0], [-w - 0.03, 0]]), () => {
    c.fillStyle = shaded(-w, w, '#6b6f7b', '#33353d');
    c.fillRect(-w - 0.05, -0.15, 2 * w + 0.1, 0.16);
    line(-w, -0.015, w, -0.015, 'rgba(255, 255, 255, 0.35)', 0.02);
  });
}

function porthole(y, r, glass) {
  c.beginPath();
  c.arc(0, y, r + 0.018, 0, Math.PI * 2);
  c.fillStyle = shaded(-r, r, '#e4e7ec', '#8d929e');
  c.fill();
  c.beginPath();
  c.arc(0, y, r, 0, Math.PI * 2);
  c.fillStyle = glass;
  c.fill();
  c.lineWidth = 0.022;
  c.strokeStyle = OUTLINE;
  c.stroke();
  c.beginPath();
  c.arc(0, y, r * 0.65, Math.PI * 1.05, Math.PI * 1.45);
  c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  c.lineWidth = 0.025;
  c.stroke();
}

// A cap of snow over the top of `path` (spanning x0..x1), down to `to`, with a jagged lower edge.
function snowCap(path, x0, x1, to, teeth = 6) {
  c.save();
  c.clip(path);
  c.beginPath();
  c.moveTo(x0 - 0.05, to + 0.03);
  for (let k = 0; k <= teeth; k++) c.lineTo(x0 + ((x1 - x0) * k) / teeth, to + (k % 2 ? 0.025 : -0.005));
  c.lineTo(x1 + 0.05, to + 0.03);
  c.lineTo(x1 + 0.05, -1.1);
  c.lineTo(x0 - 0.05, -1.1);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  c.restore();
}

function fin(side, fill, stripe, points) {
  const p = shape(points.map(([x, y]) => [side * x, y]));
  part(p, () => {
    c.fillStyle = fill;
    c.fill(p);
    const [[x0, y0], [x1, y1]] = points;
    line(side * x0, y0 + 0.07, side * x1, y1 + 0.07, stripe, 0.035);
  });
}

const ROCKETS = {
  classic(planet) {
    const w = 0.2, finPts = [[0.18, -0.38], [0.36, -0.02], [0.18, -0.1]];
    for (const side of [-1, 1]) fin(side, '#e63946', '#ffffff', finPts);
    nozzle(0.1);
    part(body(w), () => {
      c.fillStyle = shaded(-w, w, '#ffffff', '#c4c8d0');
      c.fillRect(-w, -1, 2 * w, 1);
      c.fillStyle = '#e63946';
      c.fillRect(-w, -1.05, 2 * w, 0.27);
      line(-w, -0.24, w, -0.24, '#e63946', 0.04);
      panels(w, [-0.4, -0.66]);
      grime(-w, w, -0.42, planet);
      specks(planet);
      scratches();
    });
    porthole(-0.5, 0.075, '#4cc9f0');
  },
  lander(planet) {
    const w = 0.19;
    // Landing legs out to the sides, with a pad at each foot.
    for (const side of [-1, 1]) {
      // The brace runs from the hull to a point on the leg and goes under it, so the joint stays clean.
      line(side * 0.18, -0.16, side * 0.25, -0.1, OUTLINE, 0.055);
      line(side * 0.18, -0.16, side * 0.25, -0.1, '#a9aeb8', 0.022);
      line(side * 0.15, -0.3, side * 0.3, 0.01, OUTLINE, 0.095);
      line(side * 0.15, -0.3, side * 0.3, 0.01, '#d8dbe2', 0.055);
      c.strokeStyle = OUTLINE;
      c.lineWidth = 0.035;
      c.beginPath();
      c.roundRect(side * 0.31 - 0.07, -0.01, 0.14, 0.05, 0.02);
      c.fillStyle = '#3a86ff';
      c.fill();
      c.stroke();
      if (planet.dust) {
        c.fillStyle = planet.dust;
        c.fillRect(side * 0.31 - 0.07, 0.015, 0.14, 0.02);
      }
    }
    nozzle(0.09);
    part(body(w), () => {
      c.fillStyle = shaded(-w, w, '#ffffff', '#c4c8d0');
      c.fillRect(-w, -1, 2 * w, 1);
      c.fillStyle = '#3a86ff';
      c.fillRect(-w, -1.05, 2 * w, 0.25);
      c.fillRect(-w, -0.33, 2 * w, 0.07);
      panels(w, [-0.45, -0.62]);
      grime(-w, w, -0.36, planet);
      specks(planet);
      scratches();
    });
    porthole(-0.56, 0.07, '#ffd60a');
  },
  heavy(planet) {
    const w = 0.22, blue = '#3d7aa8';
    // Two side boosters instead of fins: a broader, sturdier shape that reads even when small.
    // Each has a rounded blue cone, so it reads as a booster and not a can.
    for (const side of [-1, 1]) {
      const [inner, outer] = [side * 0.2, side * 0.38], mid = side * 0.29;
      const b = new Path2D();
      b.moveTo(inner, -0.05);
      b.lineTo(inner, -0.5);
      b.quadraticCurveTo(inner, -0.7, mid, -0.76);
      b.quadraticCurveTo(outer, -0.7, outer, -0.5);
      b.lineTo(outer, -0.05);
      b.closePath();
      part(b, () => {
        c.fillStyle = shaded(inner, outer, '#ffffff', '#c4ccd6');
        c.fillRect(-0.4, -0.8, 0.8, 0.8);
        c.fillStyle = blue;
        c.fillRect(-0.4, -0.8, 0.8, 0.22);
        line(inner, -0.3, outer, -0.3, 'rgba(0, 0, 0, 0.22)', 0.012);
        grime(-0.4, 0.4, -0.3, planet);
      });
      if (planet.snow) snowCap(b, Math.min(inner, outer), Math.max(inner, outer), -0.7, 3);
    }
    nozzle(0.11);
    part(body(w), () => {
      c.fillStyle = shaded(-w, w, '#ffa53d', '#d9661a');
      c.fillRect(-w, -1, 2 * w, 1);
      c.fillStyle = blue;
      c.fillRect(-w, -1.05, 2 * w, 0.23);
      c.fillRect(-w, -0.3, 2 * w, 0.06);
      panels(w, [-0.42, -0.66]);
      grime(-w, w, -0.4, planet);
      specks(planet);
      scratches();
    });
    porthole(-0.53, 0.08, '#bfe8ff');
    if (planet.snow) snowCap(body(w + 0.02), -w, w, -0.92);
  },
};

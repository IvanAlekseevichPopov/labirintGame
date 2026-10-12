// The planet's ground under the maze, drawn once into the maze layer: specks and small craters
// everywhere, then what makes each planet its own — dark patches on the Moon, rocks and wind
// ripples on Mars, cracks in Europa's ice. Seeded by level, like the rest of the decor, and the
// floor's shade shifts a little from level to level.

import { crack, softBlob } from './art.js';

function scatter(rand, count, cols, rows, minR, maxR) {
  return Array.from({ length: Math.round(count) }, () => ({
    x: rand() * cols,
    y: rand() * rows,
    r: minR + rand() * (maxR - minR),
  }));
}

// Specks and craters come first from `rand`, so the older levels keep exactly the ground they had.
export function makeGround(planet, rand, cols, rows) {
  const area = cols * rows;
  const craters = scatter(rand, area * 0.5, cols, rows, 0.05, 0.15);
  const specks = scatter(rand, area * 6, cols, rows, 0.01, 0.035);
  const tone = (rand() - 0.5) * 0.1;
  const busy = 0.7 + rand() * 0.6;
  const ground = { craters, specks, tone };
  if (planet === 'moon') {
    ground.patches = scatter(rand, area * 0.02 * busy, cols, rows, 0.8, 1.8).map(p => ({ ...p, seed: rand() * 6 }));
  } else if (planet === 'mars') {
    // Dark rock and pale sand side by side, wind ripples gathered into dune fields, rocks lying in
    // scatters around a few boulders: patchy rather than evenly sprinkled, so no two parts look alike.
    ground.patches = scatter(rand, area * 0.03 * busy, cols, rows, 0.8, 1.8).map(p => ({ ...p, seed: rand() * 6, light: rand() < 0.5 }));
    const wind = rand() * Math.PI;
    ground.dunes = scatter(rand, area * 0.012 * busy, cols, rows, 0.7, 1.4).map(d => ({ ...d, a: wind + (rand() - 0.5) * 0.3 }));
    ground.rocks = scatter(rand, area * 0.03 * busy, cols, rows, 0.1, 0.17).flatMap(b => [
      { ...b, seed: rand() * 6 },
      ...Array.from({ length: 2 + Math.floor(rand() * 5) }, () => {
        const a = rand() * Math.PI * 2, d = b.r + rand() * 0.45;
        return { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r: 0.03 + rand() * 0.05, seed: rand() * 6 };
      }),
    ]).concat(scatter(rand, area * 0.08, cols, rows, 0.03, 0.07).map(r => ({ ...r, seed: rand() * 6 })));
  } else {
    // Europa has hardly any craters: it is the cracks that make it.
    ground.craters = craters.filter((_, i) => i % 4 === 0);
    ground.patches = scatter(rand, area * 0.02 * busy, cols, rows, 0.8, 1.6).map(p => ({ ...p, seed: rand() * 6 }));
    ground.cracks = Array.from({ length: Math.round(area * 0.06 * busy) }, () => {
      const x = rand() * cols, y = rand() * rows, a = rand() * Math.PI, len = 1.5 + rand() * 2.5;
      const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      const main = crack([[x - dx, y - dy], [x + dx, y + dy]], rand, 4);
      const spurs = Array.from({ length: Math.floor(rand() * 3) }, () => {
        const [bx, by] = main[1 + Math.floor(rand() * (main.length - 2))], b = rand() * Math.PI * 2, l = 0.3 + rand() * 0.5;
        return crack([[bx, by], [bx + Math.cos(b) * l, by + Math.sin(b) * l]], rand, 3);
      });
      return [{ pts: main, main: true }, ...spurs.map(pts => ({ pts, main: false }))];
    });
  }
  return ground;
}

function polyline(g, pts, ox, oy, cell, dx = 0, dy = 0) {
  g.beginPath();
  pts.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo'](ox + x * cell + dx, oy + y * cell + dy));
}

// Into the maze layer, clipped to the floor; `p` is the planet's palette.
export function drawGround(g, ground, p, cell, ox, oy, w, h) {
  if (ground.tone) {
    g.fillStyle = ground.tone > 0 ? `rgba(255, 255, 255, ${ground.tone})` : `rgba(0, 0, 0, ${-ground.tone})`;
    g.fillRect(0, 0, w, h);
  }
  for (const s of ground.patches ?? []) {
    softBlob(g, ox + s.x * cell, oy + s.y * cell, s.r * cell, s.light ? p.sand : p.patch, s.seed, 0.18);
  }

  g.lineCap = 'round';
  for (const d of ground.dunes ?? []) {
    // Parallel crests across the wind, longest through the middle of the field: a lens of ripples.
    const ux = Math.cos(d.a), uy = Math.sin(d.a), gap = 0.16, n = Math.floor(d.r / gap);
    g.strokeStyle = p.craterRim;
    g.lineWidth = cell * 0.035;
    for (let k = -n; k <= n; k++) {
      const half = Math.sqrt(1 - (k / (n + 1)) ** 2) * d.r * cell;
      const cx = ox + d.x * cell - uy * k * gap * cell, cy = oy + d.y * cell + ux * k * gap * cell;
      g.beginPath();
      for (let s = 0; s <= 10; s++) {
        const t = (s / 10) * 2 - 1, wave = Math.sin(t * Math.PI * 1.5 + k) * cell * 0.04;
        g[s ? 'lineTo' : 'moveTo'](cx + ux * t * half - uy * wave, cy + uy * t * half + ux * wave);
      }
      g.globalAlpha = 0.7;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  g.fillStyle = p.speck;
  for (const s of ground.specks) {
    g.beginPath();
    g.arc(ox + s.x * cell, oy + s.y * cell, s.r * cell, 0, Math.PI * 2);
    g.fill();
  }
  for (const c of ground.craters) {
    const x = ox + c.x * cell, y = oy + c.y * cell, r = c.r * cell;
    g.fillStyle = p.crater;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.craterRim;
    g.lineWidth = r * 0.25;
    g.beginPath();
    g.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9);
    g.stroke();
  }

  for (const r of ground.rocks ?? []) {
    const x = ox + r.x * cell, y = oy + r.y * cell, s = r.r * cell;
    softBlob(g, x + s * 0.25, y + s * 0.3, s, 'rgba(0, 0, 0, 0.3)', r.seed, 0.2);
    softBlob(g, x, y, s, p.rock, r.seed, 0.2);
    softBlob(g, x - s * 0.25, y - s * 0.3, s * 0.45, p.craterRim, r.seed, 0.2);
  }

  // A crack is a groove in the ice: a dark line, its far side catching the light.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const { pts, main } of (ground.cracks ?? []).flat()) {
    polyline(g, pts, ox, oy, cell, cell * 0.018, cell * 0.022);
    g.lineWidth = cell * (main ? 0.022 : 0.015);
    g.strokeStyle = '#ffffff';
    g.stroke();
    polyline(g, pts, ox, oy, cell);
    g.lineWidth = cell * (main ? 0.03 : 0.02);
    g.strokeStyle = p.crack;
    g.stroke();
  }
}

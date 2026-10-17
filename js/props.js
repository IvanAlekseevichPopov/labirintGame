// Props: things lying about on the bigger maps so they are not empty — an old probe, a solar
// panel, an old rover with its wheels gone, and on Europa ice hummocks and a steaming geyser. Pure
// decoration: no chime, no light, no effect on the way. They are placed off the shortest route,
// dead ends first (something to find when you take a wrong turn), apart from each other and from
// the landmarks, seeded by level so a level always looks the same. Drawn upright, like the flag.

import { OUTLINE } from './art.js';
import { levelDistances, openWall } from '../level-format.js';
import { mulberry32 } from './random.js';

// One prop per this many cells, never more than one of each kind and never more than MAX_PROPS:
// they are made by people, and too many of them would read as places you are meant to drive to.
const CELLS_PER_PROP = 30;
const MAX_PROPS = 2;
// No boulders and no base dome: tried, the boulders read as something in the way and the dome
// as the place to drive to.
const KINDS = {
  moon: ['probe', 'panel', 'wreck'],
  mars: ['probe', 'panel', 'wreck'],
  europa: ['probe', 'hummocks', 'geyser', 'wreck'],
  enceladus: [],
};
// Only in a dead end, where nobody needs to pass: an old rover lying in a corridor would look
// like it blocks the way.
const DEAD_END_ONLY = new Set(['wreck']);

export function placeProps({ planet, maze, player, goal, landmarks, meteor, ice }, seed) {
  const kinds = KINDS[planet];
  const count = Math.min(MAX_PROPS, kinds.length, Math.floor((maze.cols * maze.rows) / CELLS_PER_PROP));
  if (!count) return [];
  const rand = mulberry32(seed);
  // Through the ice, as the rover can go: with it closed some cells would not be reachable at all.
  const open = ice.reduce(openWall, maze);
  const fromStart = levelDistances(open, player), fromGoal = levelDistances(open, goal);
  const route = fromStart.get(`${goal.x},${goal.y}`).dist;
  const taken = [player, goal, ...landmarks, ...(meteor ? [meteor.cell, meteor.trigger].filter(Boolean) : [])];
  const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) < 2;
  const candidates = [];
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      const key = `${x},${y}`, c = maze.cells[y][x];
      if (fromStart.get(key).dist + fromGoal.get(key).dist === route) continue;
      const deadEnd = [c.top, c.bottom, c.left, c.right].filter(Boolean).length === 3;
      candidates.push({ x, y, deadEnd, order: rand() - (deadEnd ? 1 : 0) });
    }
  }
  candidates.sort((a, b) => a.order - b.order);
  const props = [];
  for (const cell of candidates) {
    if (props.length === count) break;
    if (taken.some(t => near(t, cell)) || props.some(p => near(p, cell))) continue;
    // One of each kind at most: repeats made the maps look samey.
    const open = kinds.filter(k => !props.some(p => p.kind === k) && (cell.deadEnd || !DEAD_END_ONLY.has(k)));
    if (!open.length) continue;
    props.push({ x: cell.x, y: cell.y, kind: open[Math.floor(rand() * open.length)], seed: rand() * 100 });
  }
  return props;
}

let c;

// `toPx(cell)` is the cell's centre on screen; props stand a little below it, like the flag.
export function drawProps(context, props, toPx, cell, now, p) {
  c = context;
  for (const prop of props) {
    const [x, y] = toPx(prop);
    c.save();
    c.translate(x, y + cell * 0.3);
    c.scale(cell * 0.75, cell * 0.75);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = OUTLINE;
    c.lineWidth = 0.03;
    DRAW[prop.kind](p, now, prop.seed);
    c.restore();
  }
}

function shadow(rx) {
  c.beginPath();
  c.ellipse(0.02, 0.01, rx, rx * 0.3, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(0, 0, 0, 0.28)';
  c.fill();
}

function poly(points, fill) {
  c.beginPath();
  points.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.stroke();
}

function bar(x0, y0, x1, y1, color, width) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineWidth = width + 0.04;
  c.strokeStyle = OUTLINE;
  c.stroke();
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
  c.lineWidth = 0.03;
  c.strokeStyle = OUTLINE;
}

const DRAW = {
  // An old probe that landed long ago: a faded foil body on splayed legs, a small instrument box
  // on top. No dish: with one it looked like the antenna landmark, which chimes.
  probe(p) {
    shadow(0.3);
    c.rotate(-0.08);
    bar(-0.12, -0.2, -0.28, 0, '#8d939e', 0.035);
    bar(0.12, -0.2, 0.26, -0.02, '#8d939e', 0.035);
    bar(0, -0.2, 0.04, 0.02, '#8d939e', 0.035);
    poly([[-0.2, -0.2], [0.2, -0.2], [0.18, -0.46], [-0.18, -0.46]], '#a89470');
    c.fillStyle = 'rgba(70, 50, 30, 0.3)';
    c.fillRect(-0.06, -0.44, 0.12, 0.22);
    c.fillStyle = p.dust ?? p.craterRim;
    c.globalAlpha = 0.5;
    c.fillRect(-0.19, -0.27, 0.38, 0.06);
    c.globalAlpha = 1;
    poly([[-0.08, -0.46], [0.06, -0.46], [0.06, -0.56], [-0.08, -0.56]], '#8d939e');
  },

  // An old rover tipped over on its side, rusted dark, wheels gone: bare hubs facing us, its
  // dead solar deck standing up, the camera mast lying on the ground, one wheel beside it.
  // Kept dark and brown on purpose: grey and blue would read as the player's own rover.
  wreck(p) {
    shadow(0.42);
    bar(0.08, -0.03, 0.38, -0.01, '#6b5a4e', 0.03);
    poly([[0.36, -0.05], [0.46, -0.05], [0.46, 0.02], [0.36, 0.02]], '#6b5a4e');
    c.save();
    c.translate(-0.05, -0.17);
    c.rotate(-1.35);
    c.beginPath();
    c.roundRect(-0.16, -0.27, 0.32, 0.5, 0.04);
    c.fillStyle = '#7a4a32';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(30, 15, 10, 0.35)';
    c.fillRect(0.02, -0.27, 0.14, 0.5);
    c.fillStyle = p.dust ?? p.craterRim;
    c.globalAlpha = 0.5;
    c.fillRect(-0.16, -0.27, 0.32, 0.1);
    c.globalAlpha = 1;
    c.restore();
    c.stroke();
    poly([[-0.24, -0.25], [-0.16, -0.25], [-0.16, 0.21], [-0.24, 0.21]], '#4b3f3a');
    for (const y of [-0.15, 0.12]) {
      c.beginPath();
      c.arc(0.16, y, 0.04, 0, Math.PI * 2);
      c.fillStyle = '#3a302c';
      c.fill();
      c.stroke();
    }
    c.restore();
    c.save();
    c.translate(-0.4, -0.07);
    c.rotate(0.3);
    c.beginPath();
    c.ellipse(0, 0, 0.07, 0.085, 0, 0, Math.PI * 2);
    c.fillStyle = '#3a302c';
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 0.03, 0, Math.PI * 2);
    c.fillStyle = '#6b5a4e';
    c.fill();
    c.restore();
  },
  // A solar panel on a post, tilted to the sun: blue cells in a silver frame.
  panel() {
    shadow(0.25);
    bar(0, 0, 0, -0.38, '#9aa1ad', 0.04);
    poly([[-0.1, 0], [0.1, 0], [0.08, -0.08], [-0.08, -0.08]], '#6b6f7b');
    c.save();
    c.translate(0, -0.45);
    c.rotate(-0.25);
    // Graphite cells in a faded gold frame: blue would read as the lunokhod's own panel.
    poly([[-0.32, -0.12], [0.32, -0.12], [0.36, 0.1], [-0.36, 0.1]], '#a89470');
    poly([[-0.29, -0.1], [0.29, -0.1], [0.32, 0.08], [-0.32, 0.08]], '#33363e');
    c.strokeStyle = 'rgba(200, 185, 150, 0.45)';
    c.lineWidth = 0.012;
    for (const t of [-0.12, 0.12]) {
      c.beginPath();
      c.moveTo(t * 1.1 - 0.01 * Math.sign(t), -0.11);
      c.lineTo(t * 1.2, 0.09);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(-0.34, -0.01);
    c.lineTo(0.34, -0.01);
    c.stroke();
    c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    c.lineWidth = 0.02;
    c.beginPath();
    c.moveTo(-0.26, -0.09);
    c.lineTo(-0.12, -0.09);
    c.stroke();
    c.restore();
  },
  // A heap of chunky ice blocks pushed up by the ice, bright on the lit side, blue in shade.
  hummocks(p) {
    shadow(0.4);
    for (const [x, w, h] of [[-0.18, 0.17, 0.3], [0.17, 0.15, 0.24], [0, 0.19, 0.42]]) {
      const top = [[x - w * 0.75, -h * 0.8], [x - w * 0.1, -h], [x + w * 0.6, -h * 0.85]];
      poly([[x - w, 0], ...top, [x + w, 0]], '#e4f2fa');
      poly([[x - w * 0.1, -h], [x + w * 0.6, -h * 0.85], [x + w, 0], [x + w * 0.05, 0]], '#a9cfe3');
    }
    c.fillStyle = '#ffffff';
    c.fillRect(-0.32, -0.03, 0.64, 0.03);
  },
  // A crack in the ice that steams, then every few seconds throws up a plume of vapour.
  geyser(p, now, seed) {
    shadow(0.26);
    c.beginPath();
    c.ellipse(0, -0.02, 0.2, 0.06, 0, 0, Math.PI * 2);
    c.fillStyle = p.polynya;
    c.fill();
    c.stroke();
    const t = ((now / 1000 + seed) % 5) / 5;
    const burst = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : 0;
    // Steam puffs, each drawn over a blue-grey shadow so they show on the pale ice.
    const puffs = Array.from({ length: 7 }, (_, k) => {
      const rise = (now / 900 + k / 7 + seed) % 1;
      return {
        x: Math.sin(k * 2.1 + now / 700) * 0.06,
        y: -(0.12 + rise * (0.45 + 0.9 * burst)),
        r: 0.08 + rise * (0.1 + 0.1 * burst),
        alpha: (1 - rise) * (0.6 + 0.4 * burst),
      };
    });
    for (const [color, grow, dx, dy] of [['#6f93ad', 0.02, 0.02, 0.02], ['#ffffff', 0, 0, 0]]) {
      for (const f of puffs) {
        c.globalAlpha = f.alpha * (grow ? 0.5 : 1);
        c.beginPath();
        c.arc(f.x + dx, f.y + dy, f.r + grow, 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
      }
    }
    c.globalAlpha = 1;
  },
};

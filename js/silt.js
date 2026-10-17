// Silt the drone's propeller stirs off the floor of whatever ledge it swims over. A low murk hugs
// the floor and rolls out behind the drone, soft-edged, spreading and thinning; grains of sand are
// thrown higher, swirl and slowly settle back, and they are what makes it read as silt rather than
// smoke. Decoration only. Kept in cells, timed by the game clock, like the bubbles.

const SILT = { everyMs: 90, murkMs: 2800, grainMs: [2000, 4500] };

const ease = (t, from, to) => Math.max(0, Math.min(1, (t - from) / (to - from)));
const out = t => 1 - (1 - t) ** 2;

export function createSilt() {
  let murk = [];
  let grains = [];
  let nextAt = 0;
  let last = null;
  return {
    reset() {
      murk = [];
      grains = [];
      nextAt = 0;
      last = null;
    },
    // `floor` is the top of the ledge under the propeller in cells (null with none), `wash` where
    // the propeller's wash meets it (x in cells) and `back` the way it blows; `murk` and `grain` are
    // the colours of what lies there, 'r, g, b'.
    update(now, { floor, wash, back, stirring, murk: murkColor, grain: grainColor }) {
      const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      for (const g of grains) {
        g.vx *= Math.exp(-dt * g.drag);
        g.vy = g.vy * Math.exp(-dt * g.drag) + g.settle * dt;
        g.x += (g.vx + Math.sin(now / g.swirlMs + g.phase) * g.swirl) * dt;
        g.y = Math.min(g.floor, g.y + g.vy * dt);
      }
      murk = murk.filter(m => now - m.born < m.life);
      grains = grains.filter(g => now - g.born < g.life);
      if (!stirring || floor === null || now < nextAt) return;
      murk.push({
        x: wash + back * Math.random() * 0.15, y: floor, drift: back * (0.25 + Math.random() * 0.3),
        born: now, life: SILT.murkMs * (0.8 + Math.random() * 0.4), size: 0.8 + Math.random() * 0.5, color: murkColor,
      });
      // Mostly a few grains, now and then none, and once in a while a burst; most stay low, a few
      // are flung high. Each its own size, drag and swirl, so no two fall alike.
      const count = Math.random() < 0.15 ? 4 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3.5);
      const [lo, hi] = SILT.grainMs;
      for (let k = 0; k < count; k++) {
        grains.push({
          x: wash + (Math.random() - 0.3) * back * 0.35 + (Math.random() - 0.5) * 0.1, y: floor - 0.02, floor,
          vx: back * (0.1 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5, vy: -(0.3 + Math.random() ** 2 * 1.2),
          drag: 2 + Math.random() * 2.5, settle: 0.06 + Math.random() * 0.14,
          swirl: 0.02 + Math.random() * 0.07, swirlMs: 250 + Math.random() * 400, phase: Math.random() * Math.PI * 2,
          born: now, life: lo + Math.random() * (hi - lo), r: 0.006 + Math.random() ** 3 * 0.02, color: grainColor,
        });
      }
      nextAt = now + SILT.everyMs * (0.6 + Math.random() * 0.8);
    },
    draw(ctx, now, { cell, ox, oy }) {
      ctx.save();
      for (const m of murk) {
        const t = (now - m.born) / m.life;
        // Billows up a little at first, then sinks back onto the floor as it spreads.
        const x = ox + (m.x + m.drift * out(t)) * cell;
        const y = oy + (m.y - 0.08 * out(ease(t, 0, 0.35)) * (1 - 0.6 * ease(t, 0.35, 1))) * cell;
        const r = cell * (0.1 + 0.35 * out(t)) * m.size;
        const a = 0.28 * ease(t, 0, 0.1) * (1 - ease(t, 0.3, 1));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.45);
        const blob = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        blob.addColorStop(0, `rgba(${m.color}, ${a})`);
        blob.addColorStop(0.5, `rgba(${m.color}, ${a * 0.6})`);
        blob.addColorStop(1, `rgba(${m.color}, 0)`);
        ctx.fillStyle = blob;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
      for (const g of grains) {
        ctx.fillStyle = `rgb(${g.color})`;
        const t = (now - g.born) / g.life;
        ctx.globalAlpha = 0.9 * ease(t, 0, 0.05) * (1 - ease(t, 0.7, 1));
        ctx.beginPath();
        ctx.arc(ox + g.x * cell, oy + g.y * cell, Math.max(0.8, g.r * cell), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

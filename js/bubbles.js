// Bubbles from the drone's propeller, only while it swims.
// They shoot back from the screw, slow down, wobble upwards and fade within about a cell. Kept in
// cells, so a resize does not scatter them; timed by the game clock, so the pause freezes them.

const BUBBLES = { everyMs: 45, lifeMs: 1200, jet: 1.2, lift: 0.55 };

const ease = (t, from, to) => Math.max(0, Math.min(1, (t - from) / (to - from)));

export function createBubbles() {
  let list = [];
  let nextAt = 0;
  let last = null;
  return {
    reset() {
      list = [];
      nextAt = 0;
      last = null;
    },
    // `screw` is the propeller in cells, `back` the way it blows (-1 left, 1 right); `active` is
    // false once the drone is gone, and the bubbles already out finish rising.
    update(now, { screw, back, swimming, active }) {
      const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      for (const b of list) {
        b.vx *= Math.exp(-dt * 4);
        b.x += b.vx * dt;
        b.y -= BUBBLES.lift * dt;
      }
      list = list.filter(b => now - b.born < b.life);
      if (!active || !swimming || now < nextAt) return;
      list.push({
        x: screw.x, y: screw.y + (Math.random() - 0.5) * 0.06,
        vx: back * BUBBLES.jet * (0.6 + Math.random() * 0.6),
        born: now, life: BUBBLES.lifeMs * (0.75 + Math.random() * 0.5),
        r: 0.012 + Math.random() * 0.022, phase: Math.random() * Math.PI * 2,
      });
      nextAt = now + BUBBLES.everyMs * (0.6 + Math.random() * 0.8);
    },
    // Where the bubbles are, in px with room to wobble and grow, or null when there are none.
    bounds({ cell, ox, oy }) {
      if (!list.length) return null;
      const xs = list.map(b => b.x), ys = list.map(b => b.y), pad = 0.15;
      const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
      return { x: ox + x0 * cell, y: oy + y0 * cell, w: (x1 - x0) * cell, h: (y1 - y0) * cell };
    },
    draw(ctx, now, { cell, ox, oy }) {
      ctx.save();
      for (const b of list) {
        const t = (now - b.born) / b.life;
        const x = ox + (b.x + Math.sin(now / 180 + b.phase) * 0.03 * t) * cell, y = oy + b.y * cell;
        const r = b.r * cell * (1 + 0.4 * t);
        ctx.globalAlpha = 0.85 * ease(t, 0, 0.08) * (1 - ease(t, 0.6, 1));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 240, 255, 0.2)';
        ctx.fill();
        ctx.lineWidth = Math.max(1, r * 0.3);
        ctx.strokeStyle = 'rgba(230, 248, 255, 0.9)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

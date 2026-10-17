// Atmosphere on the later levels: meteors on the Moon, a dust storm on Mars, a snowstorm on Europa.
// Purely decorative, drawn over the whole scene and kept translucent, so the way stays visible.

// 21, not 20: Enceladus came in at 19 and every level after it moved up one.
export const WEATHER_FROM_LEVEL = 21;

// 0 before WEATHER_FROM_LEVEL, then from light to full by the last level.
export function weatherIntensity(levelNumber, levelCount) {
  if (levelNumber < WEATHER_FROM_LEVEL) return 0;
  return 0.3 + 0.7 * Math.min(1, (levelNumber - WEATHER_FROM_LEVEL) / Math.max(1, levelCount - WEATHER_FROM_LEVEL));
}

const rnd = (min, max) => min + Math.random() * (max - min);

// `area` is the maze on screen: { x, y, w, h, cell } in CSS pixels; the screen is { w, h }.
export function createWeather(planet, intensity) {
  if (!intensity) return null;
  const make = { moon: meteors, mars: dustStorm, europa: snowstorm }[planet];
  if (!make) return null;
  const system = make(intensity);
  let last = null;
  // Time comes from the game clock, so the weather freezes with the pause.
  const draw = (ctx, now, screen, area) => {
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    system.update(dt, now, screen, area);
    system.draw(ctx, now, screen, area);
  };
  // Light the weather gives off, for dark levels: [{ x, y, r, strength }] in px.
  draw.lights = cell => system.lights?.(cell) ?? [];
  return draw;
}

// Particle counts and sizes scale with the screen, so a TV and a laptop look the same.
const density = screen => (screen.w * screen.h) / (1920 * 1080);
const unit = screen => screen.h / 540;

function snowstorm(intensity) {
  let flakes = [];
  const gust = { strength: 0, target: 0, nextAt: 0 };

  // A flake comes back in where the wind brings it from: over the top, or, once it has blown out
  // to the right, in from the left at any height. Respawning only at the top would leave the
  // snow piled in the top right on a tall screen, where the wind carries it off before it falls.
  const spawn = (screen, from) => ({
    x: from === 'left' ? rnd(-20, -5) : rnd(0, screen.w),
    y: from === 'top' ? rnd(-40, -5) : rnd(0, screen.h),
    r: rnd(1.8, 4.5),
    fall: rnd(35, 85),
    drift: rnd(0.7, 1.3),
    phase: rnd(0, Math.PI * 2),
    alpha: rnd(0.45, 0.85),
  });

  return {
    update(dt, now, screen) {
      const want = Math.round(260 * intensity * density(screen));
      if (flakes.length !== want) flakes = Array.from({ length: want }, () => spawn(screen, 'anywhere'));
      // Every so often a gust drives the snow sideways, harder and faster.
      if (now >= gust.nextAt) {
        gust.target = gust.target ? 0 : rnd(0.6, 1) * intensity;
        gust.nextAt = now + (gust.target ? rnd(1800, 3000) : rnd(5000, 10000));
      }
      gust.strength += (gust.target - gust.strength) * Math.min(1, dt * 1.5);
      const wind = 50 + 260 * gust.strength;
      for (const f of flakes) {
        f.phase += dt * 2;
        f.x += (wind * f.drift + Math.sin(f.phase) * 12) * dt;
        f.y += f.fall * (1 + gust.strength) * dt;
        if (f.y > screen.h + 10) Object.assign(f, spawn(screen, 'top'));
        else if (f.x > screen.w + 20) Object.assign(f, spawn(screen, 'left'));
      }
    },
    draw(ctx) {
      ctx.save();
      ctx.lineCap = 'round';
      const streak = gust.strength > 0.3;
      // Each flake is drawn twice: a slightly larger blue-grey shadow, then white on top,
      // so it shows against the pale ice as well as against the dark sky.
      for (const [color, grow] of [['#4f7a9a', 1.6], ['#ffffff', 0]]) {
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        for (const f of flakes) {
          ctx.globalAlpha = grow ? f.alpha * 0.45 : f.alpha;
          const r = f.r + grow;
          if (streak) {
            ctx.lineWidth = r * 1.4;
            ctx.beginPath();
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(f.x - f.drift * gust.strength * 18, f.y - f.fall * 0.06);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    },
  };
}

function dustStorm(intensity) {
  let grains = [];
  let clouds = [];
  let devils = [];
  let haze = 0;

  const spawnGrain = (screen, anywhere) => ({
    x: anywhere ? rnd(0, screen.w) : rnd(-60, -5),
    y: rnd(0, screen.h),
    r: rnd(0.8, 2) * unit(screen),
    speed: rnd(160, 340) * unit(screen) / 2,
    phase: rnd(0, Math.PI * 2),
    alpha: rnd(0.4, 0.75),
    color: Math.random() < 0.6 ? '#f5c9a0' : '#7a3418',
  });

  // Big soft dust clouds rolling across the screen, what makes it read as a storm from the sofa.
  const spawnCloud = (screen, anywhere) => ({
    x: anywhere ? rnd(-0.3, 1) * screen.w : -screen.w * 0.35,
    y: rnd(0, screen.h),
    r: rnd(0.18, 0.35) * screen.h,
    speed: rnd(60, 120) * unit(screen) / 2,
  });

  const spawnDevil = area => ({
    x: rnd(area.x, area.x + area.w),
    y: rnd(area.y, area.y + area.h),
    vx: rnd(-1, 1) * area.cell * 0.25,
    vy: rnd(-1, 1) * area.cell * 0.25,
    spin: rnd(0, Math.PI * 2),
    age: 0,
    life: rnd(6, 10),
  });

  return {
    update(dt, now, screen, area) {
      const want = Math.round(240 * intensity * density(screen));
      if (grains.length !== want) grains = Array.from({ length: want }, () => spawnGrain(screen, true));
      for (const g of grains) {
        g.phase += dt * 3;
        g.x += g.speed * dt;
        g.y += Math.sin(g.phase) * 20 * dt;
        if (g.x > screen.w + 10) Object.assign(g, spawnGrain(screen, false));
      }
      const cloudCount = Math.round(2 + 3 * intensity);
      if (clouds.length !== cloudCount) clouds = Array.from({ length: cloudCount }, () => spawnCloud(screen, true));
      for (const c of clouds) {
        c.x += c.speed * dt;
        if (c.x - c.r > screen.w) Object.assign(c, spawnCloud(screen, false));
      }
      haze = (0.04 + 0.07 * intensity) * (0.6 + 0.4 * Math.sin(now / 3000));

      const devilCount = intensity > 0.6 ? 2 : 1;
      while (devils.length < devilCount) devils.push(spawnDevil(area));
      devils = devils.filter(d => d.age < d.life);
      for (const d of devils) {
        d.age += dt;
        d.spin += dt * 6;
        d.x = Math.min(area.x + area.w, Math.max(area.x, d.x + d.vx * dt));
        d.y = Math.min(area.y + area.h, Math.max(area.y, d.y + d.vy * dt));
        d.size = area.cell * 0.45;
      }
    },
    draw(ctx, now, screen) {
      ctx.save();
      ctx.fillStyle = `rgba(214, 130, 80, ${haze})`;
      ctx.fillRect(0, 0, screen.w, screen.h);
      for (const c of clouds) {
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, `rgba(222, 150, 100, ${0.14 * intensity})`);
        g.addColorStop(1, 'rgba(222, 150, 100, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      }
      for (const d of devils) {
        // Fade in and out over the first and last second of its life.
        const fade = Math.min(1, d.age, d.life - d.age) * intensity;
        for (let k = 0; k < 5; k++) {
          const a = d.spin + k * 1.3;
          const rise = k / 5;
          ctx.globalAlpha = 0.35 * fade * (1 - rise * 0.5);
          ctx.fillStyle = '#f0b48a';
          ctx.beginPath();
          ctx.ellipse(
            d.x + Math.cos(a) * d.size * 0.25 * rise, d.y - d.size * rise * 0.9,
            d.size * (0.35 + rise * 0.45), d.size * (0.12 + rise * 0.08), 0, 0, Math.PI * 2,
          );
          ctx.fill();
        }
      }
      for (const g of grains) {
        ctx.globalAlpha = g.alpha;
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x, g.y, g.r * 4, g.r);
      }
      ctx.restore();
    },
  };
}

function meteors(intensity) {
  let streaks = [];
  let puffs = [];
  let nextAt = null;

  return {
    update(dt, now, screen, area) {
      if (nextAt === null) nextAt = now + rnd(1000, 3000);
      if (now >= nextAt) {
        nextAt = now + rnd(1500, 4000) / intensity;
        // About half of them come down inside the maze and kick up a little dust.
        const lands = Math.random() < 0.5;
        const to = lands
          ? { x: rnd(area.x, area.x + area.w), y: rnd(area.y, area.y + area.h) }
          : { x: rnd(0, screen.w), y: screen.h + 50 };
        const from = { x: to.x + rnd(-1, 1) * screen.w * 0.35, y: -40 };
        const speed = 700 * unit(screen) / 2;
        streaks.push({ from, to, t: 0, duration: Math.hypot(to.x - from.x, to.y - from.y) / speed, lands, width: 2.2 * unit(screen) });
      }
      for (const s of streaks) {
        s.t += dt / s.duration;
        if (s.t >= 1 && s.lands) {
          puffs.push({
            x: s.to.x, y: s.to.y, age: 0, size: area.cell * 0.9,
            bits: Array.from({ length: 8 }, () => ({ a: rnd(0, Math.PI * 2), v: rnd(0.4, 1) })),
          });
        }
      }
      streaks = streaks.filter(s => s.t < 1);
      for (const p of puffs) p.age += dt / 0.9;
      puffs = puffs.filter(p => p.age < 1);
    },
    // An impact flashes bright and fades with the dust.
    lights(cell) {
      return puffs.map(p => ({ x: p.x, y: p.y, r: cell * (1.6 + p.age * 1.2), strength: (1 - p.age) ** 1.5 }));
    },
    draw(ctx) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const s of streaks) {
        const x = s.from.x + (s.to.x - s.from.x) * s.t;
        const y = s.from.y + (s.to.y - s.from.y) * s.t;
        const tail = 0.25;
        const tx = x - (s.to.x - s.from.x) * tail * Math.min(1, s.t * 4);
        const ty = y - (s.to.y - s.from.y) * tail * Math.min(1, s.t * 4);
        const g = ctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, 'rgba(255, 255, 255, 0)');
        g.addColorStop(1, 'rgba(255, 244, 214, 1)');
        ctx.strokeStyle = g;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      for (const p of puffs) {
        const fade = 1 - p.age;
        ctx.globalAlpha = 0.75 * fade;
        ctx.strokeStyle = '#e8eaef';
        ctx.lineWidth = p.size * 0.08;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.2 + p.age * 0.8), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#c4c8d0';
        for (const b of p.bits) {
          const d = p.size * b.v * (0.2 + p.age);
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(b.a) * d, p.y + Math.sin(b.a) * d * 0.6, p.size * 0.07 * fade, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };
}

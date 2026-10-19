// Writes FEATURES.md: every feature of the levels and where it is, worked out from levels.js, so
// it cannot drift from the levels. tests/features.test.mjs fails when FEATURES.md is out of date.
//   node tools/features.mjs

import fs from 'node:fs';
import { blockCell, levelDistances, openWall, parseLevel } from '../level-format.js';
import { LEVELS } from '../levels.js';
import { PLANETS, PLANET_KEYS } from '../js/planets.js';
import { LANDMARKS } from '../js/landmarks.js';
import { WEATHER_FROM_LEVEL } from '../js/weather.js';
import { DROPPED_LEVELS } from '../js/config.js';

const OUT = new URL('../FEATURES.md', import.meta.url);

// [1, 2, 3, 5] → "1–3, 5"
function ranges(numbers) {
  const out = [];
  for (const n of numbers) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ') || '—';
}

const key = ({ x, y }) => `${x},${y}`;
const steps = (maze, from, to) => levelDistances(maze, from).get(key(to))?.dist;

export function featuresDoc(levels = LEVELS) {
  const parsed = levels.map((level, i) => ({ n: i + 1, ...parseLevel(level, i + 1, PLANET_KEYS) }));
  const where = test => parsed.filter(test).map(l => l.n);

  const meteors = parsed.filter(l => l.meteors.length).map(({ n, meteors, maze, start, goal }) => {
    const each = meteors.map(({ cell, trigger }) => {
      const from = trigger ?? start;
      const before = steps(maze, from, goal), after = steps(blockCell(maze, cell), from, goal);
      const what = after > before ? `перекрывает путь, объезд +${after - before}` : 'в стороне от пути';
      return `${trigger ? 'по T' : 'сразу после старта'}, ${what}`;
    });
    return `${n} (${each.join('; ')})`;
  });
  const ice = parsed.filter(l => l.ice.length).map(({ n, ice, maze, start, goal }) => {
    const must = steps(maze, start, goal) === undefined;
    return `${n} (${ice.length}${must ? ', обяз.' : ''})`;
  });

  const rows = [
    ['Ночь', 'карта: `dark: true`', ranges(where(l => l.dark)), '`night.js`, `headlights.js`, `veil.js`; под водой `deep.js` (сонар)'],
    ['Пыльная буря', 'карта: `storm: { from, to }`', ranges(where(l => l.storm)), '`storm.js`, `headlights.js`, `veil.js`'],
    ['Метеорит', 'карта: `M` и `T` — по T, `m` — сразу после старта', meteors.join('; ') || '—', '`meteor.js`, `game.js`'],
    ['Ледяные стены', 'карта: `I` (в скобках — сколько; «обяз.» — без бурения до ракеты не доехать)', ice.join('; ') || '—', '`ice.js`, `game.js`'],
    ['Показ бура', "карта: `intro: 'drill'`", ranges(where(l => l.intro?.kind === 'drill')), '`game.js` (`PLAY_INTRO`), `render.js` (полосы)'],
    ['Вид сбоку, подо льдом', 'планета с `side: true`', ranges(where(l => PLANETS[l.planet].side)), '`ocean.js`, `bubbles.js`, `silt.js`, `render.js`'],
    ['Атмосфера', '`WEATHER_FROM_LEVEL` по `look` уровня', ranges(where(l => !PLANETS[l.planet].side && l.look + 1 - DROPPED_LEVELS >= WEATHER_FROM_LEVEL)), '`weather.js`'],
    ['Курильщики', 'карта: `W`, `B`', ranges(where(l => l.smokers.length)), '`ocean.js`'],
  ];
  const planets = PLANET_KEYS.map(p => `| ${PLANETS[p].name} | \`${PLANETS[p].rover}\` | ${ranges(where(l => l.planet === p))} |`);
  const landmarks = Object.entries(LANDMARKS).filter(([, l]) => l.char).map(([type, l]) =>
    `| \`${l.char}\` | ${l.name}${l.side ? ' (под водой)' : ''} | ${ranges(where(lv => lv.landmarks.some(m => m.type === type)))} |`);

  return `# Где что в игре

Собрано из \`levels.js\` командой \`node tools/features.mjs\`, руками не править: \`npm test\` падает, если файл отстал от уровней.

## Планеты

| Планета | Машина | Уровни |
|---|---|---|
${planets.join('\n')}

## Особенности уровней

| Что | Как задаётся | Уровни | Код |
|---|---|---|---|
${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}

## Ориентиры

| Буква | Что | Уровни |
|---|---|---|
${landmarks.join('\n')}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(OUT, featuresDoc());
  console.log('FEATURES.md записан');
}

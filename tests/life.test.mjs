import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, levelDistances } from '../level-format.js';
import { PLANET_KEYS, PLANETS } from '../js/planets.js';
import { LEVELS } from '../levels.js';
import { placeLife } from '../js/life.js';

const oceans = LEVELS.map((level, i) => ({ n: i + 1, ...parseLevel(level, i + 1, PLANET_KEYS) })).filter(l => PLANETS[l.planet].side);

for (const level of oceans) {
  test(`level ${level.n}: jellyfish keep off the way, schools swim along open corridors`, () => {
    const { jellies, schools } = placeLife(level, level.n);
    const from = levelDistances(level.maze, level.start), to = levelDistances(level.maze, level.goal);
    const path = from.get(`${level.goal.x},${level.goal.y}`).dist;
    assert.ok(jellies.length >= 1);
    for (const j of jellies) {
      const k = `${j.x},${j.y}`;
      assert.notEqual(from.get(k).dist + to.get(k).dist, path, `jellyfish at ${k} is on the way`);
      assert.ok(!level.smokers.some(s => s.x === j.x && (s.y === j.y || s.y - 1 === j.y)), `jellyfish at ${k} is in the smoke`);
    }
    assert.ok(schools.length >= 1);
    for (const s of schools) {
      assert.ok(s.x1 - s.x0 >= 2);
      for (let x = s.x0; x < s.x1; x++) assert.ok(!level.maze.cells[s.y][x].right, `school in row ${s.y} goes through a wall at ${x}`);
    }
    assert.deepEqual(placeLife(level, level.n), { jellies, schools }, 'same level, same places');
  });
}

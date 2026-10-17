// Look of each planet. Keys are what levels.js uses; `rover` names a drawing in art.js, `rocket` one
// in rockets.js, and `dust` or `snow` is what lies on that rocket.
export const PLANETS = {
  moon: {
    name: 'Луна', rover: 'lunokhod', rocket: 'classic', dust: '#8d909b',
    flag: { cloth: '#3a86ff', shade: '#2a6bd6', emblem: 'crescent', still: true },
    floor: '#80838f', speck: '#90939e', crater: '#696c77', craterRim: '#a3a6b1', track: '#5f626d',
    wallBase: '#3a3c45', wallTop: '#b9bcc7', patch: 'rgba(30, 32, 42, 0.12)',
  },
  mars: {
    name: 'Марс', rover: 'marsRover', rocket: 'lander', dust: '#c2623a',
    flag: { cloth: '#f4f1ea', shade: '#d9d3c4', emblem: 'planet', dusty: true },
    floor: '#b5532c', speck: '#c2623a', crater: '#933f1e', craterRim: '#d98457', track: '#8a3a1a',
    wallBase: '#56200e', wallTop: '#e28b5e', patch: 'rgba(90, 30, 10, 0.2)', sand: 'rgba(240, 160, 100, 0.22)',
    rock: '#7d3418', walls: 'rock', wallRough: 1.6,
  },
  europa: {
    name: 'Европа', rover: 'icebreaker', rocket: 'heavy', snow: true,
    flag: { cloth: '#ff8c42', shade: '#e8702a', emblem: 'snowflake', drift: true },
    floor: '#cfe2ec', speck: '#e3f0f6', crater: '#b4cddb', craterRim: '#f1f8fb', track: '#7f9fb3',
    wallBase: '#2e5570', wallTop: '#9ec7dd', polynya: '#2f5f80', crack: '#5d8aa6', patch: 'rgba(80, 130, 165, 0.1)',
    walls: 'ice', wallRough: 0.5,
    // The icebreaker drills through the ice walls (I in the map).
    drill: true,
  },
  // The ocean under the ice, seen from the side: `side` turns the maze into a cross-section with
  // the ice crust over the top row. `water` runs from just under the ice to the bottom; `floor`
  // stays for what is drawn in water colour (bites out of walls), `globe` is the icy ball from space.
  enceladus: {
    name: 'Энцелад', rover: 'drone', rocket: 'heavy', snow: true, side: true,
    water: ['#38b4d8', '#0f5f93', '#0a3560'], floor: '#0f5f93', globe: '#e9f4f8',
    ice: '#e4f3fa', iceShade: '#a9d4e8', iceDeep: '#6fb3d3',
    iceWall: '#3d7ea8', iceWallTop: '#c4e6f4',
    speck: '#f4fafc', crater: '#c9dfe9', craterRim: '#f6fbfd', track: '#7fc4e0',
    wallBase: '#26313d', wallTop: '#55687a', patch: 'rgba(0, 20, 40, 0.15)', wallRough: 1.3,
  },
};

export const PLANET_KEYS = Object.keys(PLANETS);

// Look of each planet. Keys are what levels.js uses; `rover` names a drawing in art.js.
export const PLANETS = {
  moon: {
    name: 'Луна', rover: 'lunokhod',
    floor: '#80838f', speck: '#90939e', crater: '#696c77', craterRim: '#a3a6b1', track: '#5f626d',
    wallBase: '#3a3c45', wallTop: '#b9bcc7', patch: 'rgba(30, 32, 42, 0.12)',
  },
  mars: {
    name: 'Марс', rover: 'marsRover',
    floor: '#b5532c', speck: '#c2623a', crater: '#933f1e', craterRim: '#d98457', track: '#8a3a1a',
    wallBase: '#56200e', wallTop: '#e28b5e', patch: 'rgba(90, 30, 10, 0.2)', sand: 'rgba(240, 160, 100, 0.22)',
    rock: '#7d3418',
  },
  europa: {
    name: 'Европа', rover: 'icebreaker',
    floor: '#cfe2ec', speck: '#e3f0f6', crater: '#b4cddb', craterRim: '#f1f8fb', track: '#7f9fb3',
    wallBase: '#2e5570', wallTop: '#9ec7dd', polynya: '#2f5f80', crack: '#5d8aa6', patch: 'rgba(80, 130, 165, 0.1)',
  },
};

export const PLANET_KEYS = Object.keys(PLANETS);

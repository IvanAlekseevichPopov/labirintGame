// Look of each planet. Keys are what levels.js uses; `rover` names a drawing in art.js.
export const PLANETS = {
  moon: {
    name: 'Луна', rover: 'lunokhod',
    floor: '#80838f', speck: '#90939e', crater: '#696c77', craterRim: '#a3a6b1', track: '#5f626d',
    wallBase: '#3a3c45', wallTop: '#b9bcc7',
  },
  mars: {
    name: 'Марс', rover: 'marsRover',
    floor: '#b5532c', speck: '#c2623a', crater: '#933f1e', craterRim: '#d98457', track: '#8a3a1a',
    wallBase: '#56200e', wallTop: '#e28b5e',
  },
  europa: {
    name: 'Европа', rover: 'icebreaker',
    floor: '#cfe2ec', speck: '#e3f0f6', crater: '#b4cddb', craterRim: '#f1f8fb', track: '#7f9fb3',
    wallBase: '#2e5570', wallTop: '#9ec7dd', polynya: '#2f5f80',
  },
};

export const PLANET_KEYS = Object.keys(PLANETS);

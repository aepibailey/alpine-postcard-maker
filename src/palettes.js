// One limited "ink set" per time of day, like a screen print. Every layer takes its colors from here.
export const INK_ROLES = [
  'sky', 'sun', 'far', 'peak', 'shadow', 'snow', 'snowShadow',
  'mid', 'fore', 'accent', 'wood', 'water', 'paper', 'ink', 'title',
];

export const PALETTES = {
  dawn: {
    sky: ['#5a6b9c', '#9d8fb4', '#d8a9b0', '#f2c6a8', '#f7e2c0'],
    sun: '#fbe3a0', far: '#a3a8c9', peak: '#7c86b3', shadow: '#4d5688',
    snow: '#fbeee6', snowShadow: '#c9bfd8', mid: '#6d8a7a', fore: '#36465a',
    accent: '#d9674a', wood: '#8a5a44', water: '#7d8fbf',
    paper: '#f6ecdc', ink: '#2c3450', title: '#2c3450',
  },
  midday: {
    sky: ['#6fa8cf', '#8dbcdb', '#abcfe4', '#cbe1ea', '#e6efe8'],
    sun: '#fbf3d5', far: '#9fb6cf', peak: '#557599', shadow: '#2f4a6e',
    snow: '#ffffff', snowShadow: '#c3d6e8', mid: '#6e9a5c', fore: '#2f5a3a',
    accent: '#c8452f', wood: '#8a5234', water: '#3f7fae',
    paper: '#f4ecd8', ink: '#1f3a5f', title: '#1f3a5f',
  },
  alpenglow: {
    sky: ['#3b3560', '#6d4a70', '#b3606a', '#e2876a', '#f3b27f'],
    sun: '#f9d58a', far: '#8e6283', peak: '#c0605a', shadow: '#6b3f5e',
    snow: '#f8d8c4', snowShadow: '#d9998f', mid: '#4a3a5c', fore: '#26243f',
    accent: '#e2533f', wood: '#7a4a3c', water: '#4a5a86',
    paper: '#f5e7cf', ink: '#26243f', title: '#f5e7cf',
  },
  night: {
    sky: ['#0f1633', '#141d40', '#1a264e', '#22305d', '#2c3c6b'],
    sun: '#f3e6b0', far: '#26345c', peak: '#3a4c7a', shadow: '#1c2648',
    snow: '#dfe6f2', snowShadow: '#8f9fc2', mid: '#e3e9f3', fore: '#10162e',
    accent: '#f0b84a', wood: '#3a2c3a', water: '#1c2648',
    paper: '#f3e6c8', ink: '#10162e', title: '#f3e6c8',
  },
};

// Blend two #rrggbb colors; t=0 gives a, t=1 gives b.
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

// The same palette seen in still water: every ink pulled toward the water color.
export function reflected(palette, amount = 0.45) {
  const out = { ...palette };
  for (const role of INK_ROLES) {
    if (typeof palette[role] === 'string') out[role] = mix(palette[role], palette.water, amount);
  }
  return out;
}

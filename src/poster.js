import { createRng } from './rng.js';
import { PALETTES } from './palettes.js';
import { sky, sun, moon, stars } from './layers/sky.js';
import { mountain, farRange } from './layers/mountains.js';
import { composeScenery } from './scene.js';
import { text, banner, FONTS } from './layers/lettering.js';
import { border } from './layers/border.js';

export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 1800;
const HORIZON = 1150;

// Where the sun (or moon) sits for each time of day, unless a recipe places it itself.
const CELESTIAL = {
  dawn: { x: 330, y: 960, r: 150 },
  midday: { x: 930, y: 480, r: 95 },
  alpenglow: { x: 300, y: 560, r: 100 },
  night: { x: 900, y: 420, r: 80 },
};

function lettering(recipe, p) {
  const { title, tagline, layout } = recipe.lettering;
  switch (layout) {
    case 'banner':
      return banner(p, { title, tagline });
    case 'spaced':
      return text(title.toUpperCase(), { y: 270, size: 118, font: FONTS.sans, weight: 700, fill: p.title, spacing: 26, widthPerEm: 0.62 }) +
        text(tagline.toUpperCase(), { y: 1700, size: 44, font: FONTS.sans, weight: 600, fill: p.ink, spacing: 14, widthPerEm: 0.62 });
    default:
      return text(title.toUpperCase(), { y: 290, size: 190, fill: p.title, spacing: 10 }) +
        text(tagline.toUpperCase(), { y: 1700, size: 50, font: FONTS.sans, weight: 600, fill: p.paper, spacing: 12, widthPerEm: 0.62 });
  }
}

// Recipe → complete poster SVG markup. `id` keeps clip/mask ids unique when several posters share a page.
export function renderPoster(recipe, { id = recipe.id } = {}) {
  const p = PALETTES[recipe.time];
  const rng = createRng(recipe.seed);
  const body = { ...CELESTIAL[recipe.time], ...recipe.sun };
  const celestial = recipe.time === 'night'
    ? stars(p, rng, { count: 80, bottom: 1000 }) + moon(p, { id, ...body })
    : sun(p, body);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${recipe.lettering.title} poster">` +
    sky(p, { horizon: HORIZON }) +
    celestial +
    farRange(p, createRng(recipe.seed), { minY: 820, maxY: 940 }) +
    mountain(p, { id, kind: recipe.peak, seed: recipe.peakSeed }) +
    composeScenery(recipe, p, id) +
    lettering(recipe, p) +
    border(p) +
    `</svg>`;
}

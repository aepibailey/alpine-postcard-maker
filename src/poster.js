import { createRng } from './rng.js';
import { PALETTES } from './palettes.js';
import { sky, sun, moon, stars } from './layers/sky.js';
import { mountain, farRange } from './layers/mountains.js';
import { composeScenery } from './scene.js';
import { escapeText } from './svg.js';
import { printStyle, PRINT_STYLES } from './styles/print.js';
import { lettering } from './layers/lettering.js';
import { border } from './layers/border.js';
import { renderPhotoPoster } from './photo/photo-poster.js';
import { cachedArt } from './photo/photo-art.js';

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

// Photo posters are always flat: the photo's flat inks are their finish.
export const styleOf = (recipe) => (!recipe.photo && PRINT_STYLES.includes(recipe.style) ? recipe.style : 'flat');

// Recipe → complete poster SVG markup. `id` keeps clip/mask ids unique when several posters share a page.
// Exports that fill a whole screen draw the poster without its paper border (frame: false) and add
// the print texture over the whole image themselves (overlay: false).
// Photo posters use their posterized art: `art` if given, else the preview's if it's ready (a plain
// tint until then), or the plain photo (`raw`) while the owner drags it.
export function renderPoster(recipe, { id = recipe.id, frame = true, overlay = true, art, raw } = {}) {
  if (recipe.photo) return renderPhotoPoster(recipe, art ?? cachedArt(recipe), { id, frame, raw });
  const p = PALETTES[recipe.time];
  const rng = createRng(recipe.seed);
  const body = { ...CELESTIAL[recipe.time], ...recipe.sun };
  const celestial = recipe.time === 'night'
    ? stars(p, rng, { count: 80, bottom: 1000 }) + moon(p, { id, ...body })
    : sun(p, body);

  const style = styleOf(recipe);
  const print = printStyle(style, p, { id, seed: recipe.seed });
  const drawn = sky(p, { horizon: HORIZON }) +
    celestial +
    farRange(p, createRng(recipe.seed), { minY: 820, maxY: 940 }) +
    mountain(p, { id, kind: recipe.peak, seed: recipe.peakSeed }) +
    composeScenery(recipe, p, id) +
    lettering(recipe, p, id);
  const wrap = (filter, content) => (filter ? `<g filter="url(#${filter})">${content}</g>` : content);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${escapeText(recipe.lettering?.title || 'Untitled')} poster" data-style="${style}">` +
    (print.defs ? `<defs>${print.defs}</defs>` : '') +
    wrap(print.posterFilter, wrap(print.artFilter, drawn) + (frame ? border(p) : '')) +
    (overlay ? print.overlay : '') +
    `</svg>`;
}

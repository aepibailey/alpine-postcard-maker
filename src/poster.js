import { createRng } from './rng.js';
import { PALETTES, reflected, mix } from './palettes.js';
import { sky, sun, moon, stars } from './layers/sky.js';
import { mountain, farRange } from './layers/mountains.js';
import { village, foothills, lakeWater, hut, forest, skier, gondola } from './layers/scenery.js';
import { text, banner, FONTS } from './layers/lettering.js';
import { border } from './layers/border.js';

export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 1800;
const HORIZON = 1150;

function scene(recipe, p, rng, id) {
  switch (recipe.scene) {
    case 'village':
      return village(p, rng, { horizon: HORIZON });

    case 'lake': {
      const lakeBottom = 1480;
      const r = reflected(p);
      // Squash the mirror image so the whole peak, snow included, fits in the lake.
      const mirror = `translate(0 ${HORIZON}) scale(1 -0.45) translate(0 ${-HORIZON})`;
      return foothills(p, rng, { horizon: HORIZON, color: p.fore }) +
        `<clipPath id="${id}-lake"><rect x="0" y="${HORIZON}" width="${POSTER_WIDTH}" height="${lakeBottom - HORIZON}"/></clipPath>` +
        `<rect x="0" y="${HORIZON}" width="${POSTER_WIDTH}" height="${lakeBottom - HORIZON}" fill="${p.water}"/>` +
        `<g clip-path="url(#${id}-lake)" opacity="0.9">` +
          `<g transform="${mirror}">${farRange(r, createRng(recipe.seed), { minY: 820, maxY: 940 })}</g>` +
          mountain(r, { id: `${id}-refl`, kind: recipe.peak, seed: recipe.peakSeed, transform: mirror }) +
        `</g>` +
        `<path d="M0,${HORIZON} L1200,${HORIZON} L1200,${HORIZON + 50} C900,${HORIZON + 70} 700,${HORIZON + 30} 500,${HORIZON + 40} C300,${HORIZON + 50} 150,${HORIZON + 30} 0,${HORIZON + 45} Z" fill="${mix(p.fore, p.water, 0.45)}"/>` +
        lakeWater(p, rng, { top: HORIZON, bottom: lakeBottom }) +
        `<path d="M0,${lakeBottom - 20} C300,${lakeBottom - 50} 700,${lakeBottom + 10} 1200,${lakeBottom - 30} L1200,1800 L0,1800 Z" fill="${p.mid}"/>` +
        hut(p, { x: 150, y: lakeBottom - 6, s: 1 }) +
        forest(p, rng, { x0: 360, x1: 470, baseY: lakeBottom - 2, minH: 90, maxH: 130, color: p.fore }) +
        forest(p, rng, { x0: 820, x1: 1180, baseY: lakeBottom - 14, minH: 110, maxH: 180, color: p.fore });
    }

    case 'slope': {
      const snowfield = `<rect x="0" y="${HORIZON}" width="${POSTER_WIDTH}" height="200" fill="${p.snow}"/>`;
      const slope = `<path d="M0,1230 C380,1150 760,1330 1200,1200 L1200,1800 L0,1800 Z" fill="${p.mid}"/>` +
        `<path d="M0,1470 C300,1420 640,1500 1200,1440" stroke="${p.snowShadow}" stroke-width="6" fill="none" opacity="0.6"/>` +
        `<path d="M200,1600 C520,1560 820,1640 1200,1590" stroke="${p.snowShadow}" stroke-width="6" fill="none" opacity="0.6"/>`;
      return snowfield +
        gondola(p, { from: [1210, 600], to: [120, 1240], t: 0.3, color: p.fore }) +
        slope +
        forest(p, rng, { x0: 30, x1: 250, baseY: 1300, minH: 150, maxH: 240, color: p.fore }) +
        forest(p, rng, { x0: 1000, x1: 1190, baseY: 1260, minH: 110, maxH: 170, color: p.fore }) +
        skier(p, { x: 700, y: 1400, s: 1.15, color: p.ink });
    }

    default:
      return '';
  }
}

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
  const celestial = recipe.time === 'night'
    ? stars(p, rng, { count: 80, bottom: 1000 }) + moon(p, { id, x: 900, y: 420, r: 80 })
    : sun(p, { x: recipe.sun?.x ?? 860, y: recipe.sun?.y ?? 420, r: recipe.sun?.r ?? 110 });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${recipe.lettering.title} poster">` +
    sky(p, { horizon: HORIZON }) +
    celestial +
    farRange(p, createRng(recipe.seed), { minY: 820, maxY: 940 }) +
    mountain(p, { id, kind: recipe.peak, seed: recipe.peakSeed }) +
    scene(recipe, p, rng, id) +
    lettering(recipe, p) +
    border(p) +
    `</svg>`;
}

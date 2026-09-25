import { createRng } from './rng.js';
import { reflected, mix } from './palettes.js';
import { mountain, farRange } from './layers/mountains.js';
import { village, foothills, lakeWater, hut, forest, skier, gondola } from './layers/scenery.js';

const W = 1200;
const HORIZON = 1150;
const LAKE_BOTTOM = 1480;

export const SCENERY = ['village', 'hut', 'gondola', 'forest', 'lake', 'skier'];

// Posters saved before scenery switches existed named a whole scene instead.
const LEGACY_SCENES = {
  village: { village: true, forest: true },
  lake: { lake: true, hut: true, forest: true },
  slope: { skier: true, gondola: true, forest: true },
};

export function sceneryOf(recipe) {
  const on = recipe.layers ?? LEGACY_SCENES[recipe.scene] ?? {};
  return Object.fromEntries(SCENERY.map((name) => [name, Boolean(on[name])]));
}

// Each layer draws from its own random stream, so switching one on never reshuffles another.
const rngFor = (recipe, layer) => createRng((recipe.seed ?? 0) * 31 + SCENERY.indexOf(layer) + 1);

function lake(recipe, p, id) {
  const r = reflected(p);
  // Squash the mirror image so the whole peak, snow included, fits in the lake.
  const mirror = `translate(0 ${HORIZON}) scale(1 -0.45) translate(0 ${-HORIZON})`;
  return foothills(p, { horizon: HORIZON, color: p.fore }) +
    `<clipPath id="${id}-lake"><rect x="0" y="${HORIZON}" width="${W}" height="${LAKE_BOTTOM - HORIZON}"/></clipPath>` +
    `<rect x="0" y="${HORIZON}" width="${W}" height="${LAKE_BOTTOM - HORIZON}" fill="${p.water}"/>` +
    `<g clip-path="url(#${id}-lake)" opacity="0.9">` +
      `<g transform="${mirror}">${farRange(r, createRng(recipe.seed), { minY: 820, maxY: 940 })}</g>` +
      mountain(r, { id: `${id}-refl`, kind: recipe.peak, seed: recipe.peakSeed, transform: mirror }) +
    `</g>` +
    `<path d="M0,${HORIZON} L1200,${HORIZON} L1200,${HORIZON + 50} C900,${HORIZON + 70} 700,${HORIZON + 30} 500,${HORIZON + 40} C300,${HORIZON + 50} 150,${HORIZON + 30} 0,${HORIZON + 45} Z" fill="${mix(p.fore, p.water, 0.45)}"/>` +
    lakeWater(p, createRng(recipe.seed), { top: HORIZON, bottom: LAKE_BOTTOM }) +
    // Near shore, then a darker band for the tagline to sit on.
    `<path d="M0,${LAKE_BOTTOM - 20} C300,${LAKE_BOTTOM - 50} 700,${LAKE_BOTTOM + 10} 1200,${LAKE_BOTTOM - 30} L1200,1800 L0,1800 Z" fill="${p.mid}"/>` +
    `<path d="M0,1590 C400,1560 800,1610 1200,1580 L1200,1800 L0,1800 Z" fill="${p.fore}"/>`;
}

function hill(p) {
  return `<path d="M0,${HORIZON + 40} C300,${HORIZON - 20} 700,${HORIZON + 30} 1200,${HORIZON + 10} L1200,1800 L0,1800 Z" fill="${p.mid}"/>` +
    `<path d="M0,1420 C260,1370 520,1440 820,1400 C980,1380 1100,1400 1200,1390 L1200,1800 L0,1800 Z" fill="${p.fore}"/>`;
}

// A lane winding down from the village toward the viewer.
function lane(p, lit) {
  return `<path d="M565,1330 C520,1400 640,1440 590,1510 C530,1590 360,1640 380,1800 L640,1800 C600,1660 720,1580 700,1500 C680,1430 600,1400 625,1330 Z" fill="${lit ? p.snowShadow : p.mid}"/>`;
}

// A snowy bank in the foreground carrying the skier and their trail.
// It always stops above the tagline so the lettering stays readable.
const SLOPE_BOTTOM = 1625;
function skiSlope(p, top) {
  const h = SLOPE_BOTTOM - top;
  return `<path d="M-10,${top} C250,${top + h * 0.08} 520,${top + h * 0.45} 800,${SLOPE_BOTTOM} L-10,${SLOPE_BOTTOM} Z" fill="${p.snow}"/>` +
    skier(p, { x: 390, y: top + h * 0.5, s: 0.75, color: p.ink });
}

// Everything between the mountain and the lettering, in back-to-front order.
export function composeScenery(recipe, p, id) {
  const on = sceneryOf(recipe);
  const lit = recipe.time === 'night';
  const L = on.lake;
  let out = L ? lake(recipe, p, id) : hill(p);

  if (on.gondola) {
    out += L
      ? gondola(p, { from: [1210, 560], to: [-10, 1080], t: 0.3, pylonAt: 0.55, groundY: HORIZON - 80, color: p.fore })
      : gondola(p, { from: [1210, 600], to: [140, 1250], t: 0.3, pylonAt: 0.6, groundY: HORIZON + 20, color: p.fore });
  }

  if (on.forest) {
    const rng = rngFor(recipe, 'forest');
    out += L
      ? forest(p, rng, { x0: 10, x1: 380, baseY: HORIZON - 100, minH: 50, maxH: 80, density: 1.3 }) +
        forest(p, rng, { x0: 880, x1: 1190, baseY: HORIZON - 120, minH: 50, maxH: 90, density: 1.3 })
      : forest(p, rng, { x0: 40, x1: 230, baseY: 1260, minH: 80, maxH: 130 }) +
        forest(p, rng, { x0: 900, x1: 1180, baseY: 1250, minH: 70, maxH: 120 });
  }

  if (on.village) {
    // On the hill it fills the middle ground; with a lake it sits small on the far shore.
    out += L
      ? `<g transform="translate(282 426) scale(0.55)">${village(p, { lit })}</g>`
      : village(p, { lit }) + lane(p, lit);
  }

  if (on.skier) out += skiSlope(p, L ? 1470 : 1380);

  if (on.hut) out += L ? hut(p, { x: 150, y: LAKE_BOTTOM - 6, s: 1 }) : hut(p, { x: 905, y: 1330, s: 0.8 });

  if (on.forest) {
    const rng = rngFor(recipe, 'forest-front');
    out += L
      ? forest(p, rng, { x0: 360, x1: 470, baseY: LAKE_BOTTOM - 2, minH: 90, maxH: 130 }) +
        forest(p, rng, { x0: 820, x1: 1180, baseY: LAKE_BOTTOM - 14, minH: 110, maxH: 180 })
      : forest(p, rng, { x0: 20, x1: 200, baseY: 1460, minH: 180, maxH: 260, density: 0.9 }) +
        forest(p, rng, { x0: 1030, x1: 1200, baseY: 1450, minH: 170, maxH: 250, density: 0.9 });
  }
  return out;
}

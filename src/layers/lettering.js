import { escapeText } from '../svg.js';

export const FONTS = {
  display: "'Limelight', 'Georgia', serif",
  sans: "'Josefin Sans', 'Trebuchet MS', sans-serif",
};

// Title typefaces (all SIL OFL, bundled in /fonts). widthPerEm is an average glyph width used to fit
// long names; spacingEm is letter-spacing as a share of the font size, so it shrinks with the text.
export const TYPEFACES = {
  limelight: { label: 'Limelight', family: FONTS.display, weight: 400, size: 190, widthPerEm: 0.74, spacingEm: 0.05 },
  poiret: { label: 'Poiret One', family: "'Poiret One', 'Trebuchet MS', sans-serif", weight: 400, size: 190, widthPerEm: 0.66, spacingEm: 0.07, stroke: 3 },
  bebas: { label: 'Bebas Neue', family: "'Bebas Neue', 'Impact', sans-serif", weight: 400, size: 220, widthPerEm: 0.42, spacingEm: 0.06 },
  josefin: { label: 'Josefin Sans', family: FONTS.sans, weight: 700, size: 130, widthPerEm: 0.72, spacingEm: 0.19 },
};

export const LAYOUTS = ['top', 'bottom', 'arched', 'banner'];

const TAGLINE = { family: FONTS.sans, weight: 600, widthPerEm: 0.62, spacingEm: 0.24 };

const estimate = (str, face, size) => str.length * size * (face.widthPerEm + face.spacingEm);

// Biggest size (up to `size`) at which the text is estimated to fit in maxWidth.
function fitSize(str, face, maxWidth, size = face.size) {
  return Math.min(size, Math.floor(maxWidth / (Math.max(str.length, 1) * (face.widthPerEm + face.spacingEm))));
}

// Text that had to shrink to fit is also pinned to the exact width, so unusually wide letters (Ms, Ws) can never overflow.
function lengthAttrs(str, face, size, maxWidth) {
  return estimate(str, face, size) > maxWidth * 0.97 ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
}

function textAttrs(face, size, fill) {
  const stroke = face.stroke ? ` stroke="${fill}" stroke-width="${face.stroke}"` : '';
  const spacing = Math.round(face.spacingEm * size * 10) / 10;
  return `text-anchor="middle" font-family="${face.family}" font-size="${size}" font-weight="${face.weight}" letter-spacing="${spacing}" fill="${fill}"${stroke}`;
}

function line(str, face, { x = 600, y, fill, size = face.size, maxWidth = 1040 }) {
  if (!str) return '';
  const fitted = fitSize(str, face, maxWidth, size);
  return `<text x="${x}" y="${y}" ${textAttrs(face, fitted, fill)}${lengthAttrs(str, face, fitted, maxWidth)} data-role="lettering">${escapeText(str)}</text>`;
}

const title = (str, face, opts) => line(str, face, opts);
const tagline = (str, { y, fill, size = 50 }) => line(str, TAGLINE, { y, fill, size });

// Title bent along a gentle arc across the sky.
function arched(str, face, { id, fill }) {
  if (!str) return '';
  const arcWidth = 980;
  const size = fitSize(str, face, arcWidth, Math.round(face.size * 0.85));
  return `<path id="${id}-arc" d="M130,420 Q600,110 1070,420" fill="none"/>` +
    `<text ${textAttrs(face, size, fill)}${lengthAttrs(str, face, size, arcWidth)} data-role="lettering">` +
    `<textPath href="#${id}-arc" startOffset="50%">${escapeText(str)}</textPath></text>`;
}

// A cream banner across the bottom holding the title and tagline.
export function banner(p, { title: t, tagline: tag, face = TYPEFACES.limelight, top = 1540, bottom = 1770 }) {
  return `<rect x="0" y="${top}" width="1200" height="${bottom - top}" fill="${p.paper}"/>` +
    `<rect x="60" y="${top + 16}" width="1080" height="4" fill="${p.ink}"/>` +
    `<rect x="60" y="${bottom - 20}" width="1080" height="4" fill="${p.ink}"/>` +
    title(t, face, { y: top + 150, fill: p.ink, size: Math.round(face.size * 0.72) }) +
    tagline(tag, { y: bottom - 44, fill: p.accent, size: 34 });
}

// Recipes from before the typeface picker: 'spaced' was the Josefin Sans title at the top.
export function letteringOf(recipe) {
  const l = recipe.lettering ?? {};
  const legacySpaced = l.layout === 'spaced';
  return {
    title: String(l.title ?? '').toUpperCase(),
    tagline: String(l.tagline ?? '').toUpperCase(),
    layout: legacySpaced ? 'top' : (LAYOUTS.includes(l.layout) ? l.layout : 'top'),
    font: TYPEFACES[l.font] ? l.font : (legacySpaced ? 'josefin' : 'limelight'),
  };
}

// Where the title and tagline sit on the poster.
export function lettering(recipe, p, id) {
  const { title: t, tagline: tag, layout, font } = letteringOf(recipe);
  const face = TYPEFACES[font];
  switch (layout) {
    case 'banner':
      return banner(p, { title: t, tagline: tag, face });
    case 'arched':
      return arched(t, face, { id, fill: p.title }) + tagline(tag, { y: 1700, fill: p.paper });
    case 'bottom':
      // A solid ground-coloured band keeps the big title readable over any scenery.
      return `<rect x="0" y="1540" width="1200" height="260" fill="${p.fore}"/>` +
        title(t, face, { y: 1715, fill: p.paper, size: Math.round(face.size * 0.9) }) +
        tagline(tag, { y: 175, fill: p.title, size: 44 });
    default:
      return title(t, face, { y: 290, fill: p.title }) + tagline(tag, { y: 1700, fill: p.paper });
  }
}

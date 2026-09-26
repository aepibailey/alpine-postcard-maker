// Print styles: how the finished poster looks as a physical print.
// All effects are SVG filters and overlays, so the preview and the exported image match.
export const PRINT_STYLES = ['flat', 'screenprint', 'aged'];

// Overlays and filter regions cover a width × height area (the poster, or a whole export canvas).

// Fine speckles of one colour, from high-frequency noise thresholded into dots.
function specks(id, seed, { color, density, frequency = 0.9, threshold = 0.62 }, W, H) {
  return `<filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${density} 0 0 0 ${(-density * threshold).toFixed(2)}" result="dots"/>` +
    `<feFlood flood-color="${color}"/><feComposite operator="in" in2="dots"/>` +
    `</filter>`;
}

// The screen-print look: ink edges that wander slightly, and grain in the paper.
function screenprint(p, id, seed, W, H) {
  const defs =
    `<filter id="${id}-ink" x="-2%" y="-2%" width="104%" height="104%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="${seed}" result="wobble"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="wobble" scale="5" xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter>` +
    specks(`${id}-grain-dark`, seed, { color: p.ink, density: 9, threshold: 0.66 }, W, H) +
    specks(`${id}-grain-light`, seed + 7, { color: p.paper, density: 9, threshold: 0.68, frequency: 0.7 }, W, H);
  const overlay =
    `<rect width="${W}" height="${H}" filter="url(#${id}-grain-dark)" opacity="0.3" style="mix-blend-mode:multiply" pointer-events="none"/>` +
    `<rect width="${W}" height="${H}" filter="url(#${id}-grain-light)" opacity="0.35" pointer-events="none"/>`;
  return { defs, artFilter: `${id}-ink`, overlay };
}

// Old and loved: faded warm inks, tea stains, darkened edges and fold lines.
function aged(p, id, seed, W, H) {
  const defs =
    `<filter id="${id}-fade" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="matrix" values="0.78 0.16 0.06 0 0.05  0.10 0.76 0.08 0 0.04  0.08 0.14 0.60 0 0.03  0 0 0 1 0"/>` +
    `</filter>` +
    `<filter id="${id}-stains" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.0045" numOctaves="3" seed="${seed}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.30  0 0 0 0 0.12  2.4 0 0 0 -1.25"/>` +
      `<feComposite operator="in" in2="SourceGraphic"/>` +
    `</filter>` +
    `<radialGradient id="${id}-vignette" cx="50%" cy="50%" r="72%">` +
      `<stop offset="62%" stop-color="#6b4a2a" stop-opacity="0"/>` +
      `<stop offset="100%" stop-color="#6b4a2a" stop-opacity="0.55"/>` +
    `</radialGradient>` +
    specks(`${id}-grain`, seed + 3, { color: '#5a3e24', density: 2.6 }, W, H);
  const fold = (x1, y1, x2, y2) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="3" opacity="0.28"/>` +
    `<line x1="${x1 + (x1 === x2 ? 3 : 0)}" y1="${y1 + (y1 === y2 ? 3 : 0)}" x2="${x2 + (x1 === x2 ? 3 : 0)}" y2="${y2 + (y1 === y2 ? 3 : 0)}" stroke="#4a3520" stroke-width="3" opacity="0.18"/>`;
  const overlay =
    `<g pointer-events="none">` +
      `<rect width="${W}" height="${H}" filter="url(#${id}-stains)" opacity="0.35" style="mix-blend-mode:multiply"/>` +
      `<rect width="${W}" height="${H}" fill="url(#${id}-vignette)" style="mix-blend-mode:multiply"/>` +
      `<rect width="${W}" height="${H}" filter="url(#${id}-grain)" opacity="0.3" style="mix-blend-mode:multiply"/>` +
      fold(W / 2, 0, W / 2, H) + fold(0, H / 2, W, H / 2) +
    `</g>`;
  return { defs, posterFilter: `${id}-fade`, overlay };
}

// → { defs, artFilter?, posterFilter?, overlay } for the chosen style ('flat' adds nothing).
export function printStyle(style, p, { id, seed = 1, width = 1200, height = 1800 }) {
  const s = Math.abs(Math.round(seed)) % 1000;
  if (style === 'screenprint') return screenprint(p, id, s, width, height);
  if (style === 'aged') return aged(p, id, s, width, height);
  return { defs: '', overlay: '' };
}

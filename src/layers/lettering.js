import { escapeText } from '../svg.js';

export const FONTS = {
  display: "'Limelight', 'Georgia', serif",
  sans: "'Josefin Sans', 'Trebuchet MS', sans-serif",
};

// Shrink long names so they always fit inside the poster margins.
function fitSize(text, size, maxWidth, widthPerEm) {
  const estimated = text.length * size * widthPerEm;
  return estimated > maxWidth ? Math.floor(size * (maxWidth / estimated)) : size;
}

export function text(str, { x = 600, y, size, font = FONTS.display, fill, spacing = 0, weight = 400, widthPerEm = 0.7, maxWidth = 1040 }) {
  const fitted = fitSize(str, size, maxWidth, widthPerEm + spacing / size);
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${font}" font-size="${fitted}" font-weight="${weight}" letter-spacing="${spacing}" fill="${fill}">${escapeText(str)}</text>`;
}

// A cream banner across the bottom holding the title and tagline.
export function banner(p, { title, tagline, top = 1540, bottom = 1770 }) {
  return `<rect x="0" y="${top}" width="1200" height="${bottom - top}" fill="${p.paper}"/>` +
    `<rect x="60" y="${top + 16}" width="1080" height="4" fill="${p.ink}"/>` +
    `<rect x="60" y="${bottom - 20}" width="1080" height="4" fill="${p.ink}"/>` +
    text(title.toUpperCase(), { y: top + 150, size: 136, fill: p.ink, spacing: 6 }) +
    (tagline ? text(tagline.toUpperCase(), { y: bottom - 44, size: 34, font: FONTS.sans, weight: 600, fill: p.accent, spacing: 12, widthPerEm: 0.62 }) : '');
}

import { PALETTES } from '../palettes.js';
import { lettering, letteringOf } from '../layers/lettering.js';
import { border } from '../layers/border.js';
import { escapeText } from '../svg.js';
import { toLab } from './posterize.js';

export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 1800;

const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const L = (rgb) => toLab(...rgb)[0];

// Average lightness of a horizontal band of the posterized image (0 = top, 1 = bottom).
function bandLightness({ width, height, data }, from, to) {
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(from * height); y < Math.floor(to * height); y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      sum += L([data[i], data[i + 1], data[i + 2]]);
      n++;
    }
  }
  return n ? sum / n : 50;
}

// Lettering inks for a photo poster: the lightest or darkest of its own inks, whichever
// stands out against the part of the photo the words sit on.
// Bands (the banner and bottom layouts) stay cream with dark words, like the drawn posters.
export function letteringInks(poster, time, layout = 'top') {
  const p = PALETTES[time] ?? PALETTES.alpenglow;
  const sorted = [...poster.inks].sort((a, b) => L(a) - L(b));
  const dark = toHex(sorted[0]);
  const light = toHex(sorted.at(-1));
  const on = (from, to) => (bandLightness(poster, from, to) > 55 ? dark : light);
  if (layout === 'banner') return { ...p, ink: dark };
  if (layout === 'bottom') return { ...p, fore: dark, title: on(0.06, 0.13) };
  return { ...p, title: on(layout === 'arched' ? 0.06 : 0.1, layout === 'arched' ? 0.24 : 0.2), paper: on(0.91, 0.97) };
}

// The part of the photo that fills the 2:3 poster. x, y (0–1) say which part is centred; zoom ≥ 1.
export function cropRect(photoWidth, photoHeight, { x = 0.5, y = 0.5, zoom = 1 } = {}, aspect = POSTER_WIDTH / POSTER_HEIGHT) {
  let w = photoWidth;
  let h = w / aspect;
  if (h > photoHeight) { h = photoHeight; w = h * aspect; }
  w /= zoom;
  h /= zoom;
  const left = Math.min(photoWidth - w, Math.max(0, x * photoWidth - w / 2));
  const top = Math.min(photoHeight - h, Math.max(0, y * photoHeight - h / 2));
  return { left, top, width: w, height: h };
}

// Browser only: the cropped photo as pixels, ready to posterize.
export function cropToImageData(img, crop, width, height) {
  const r = cropRect(img.naturalWidth ?? img.width, img.naturalHeight ?? img.height, crop, width / height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, r.left, r.top, r.width, r.height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// Browser only: posterized pixels → PNG data URL.
export function imageDataToUrl({ width, height, data }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

// Photo poster: the flat-ink photo, with the owner's lettering and the cream border on top.
export function renderPhotoPoster(recipe, poster, url, { id = recipe.id ?? 'photo', frame = true } = {}) {
  const p = letteringInks(poster, recipe.time, letteringOf(recipe).layout);
  const paper = PALETTES[recipe.time] ?? PALETTES.alpenglow;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${escapeText(recipe.lettering?.title || 'Untitled')} poster">` +
    `<image href="${url}" x="0" y="0" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" preserveAspectRatio="none"/>` +
    lettering(recipe, p, id) +
    (frame ? border(paper) : '') +
    `</svg>`;
}

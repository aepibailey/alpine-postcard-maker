import { PALETTES } from '../palettes.js';
import { lettering, letteringOf } from '../layers/lettering.js';
import { border } from '../layers/border.js';
import { escapeText } from '../svg.js';
import { toLab } from './posterize.js';

// Same size as the drawn posters (poster.js), repeated here so this module stands alone.
const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 1800;
const ROWS = 60;

const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const L = (rgb) => toLab(...rgb)[0];

// Average lightness of each of ROWS horizontal bands of a posterized image, top to bottom.
// It's all the lettering needs to know about the picture, and much smaller to keep than the pixels.
export function lightnessRows({ width, height, data }) {
  const rows = new Float32Array(ROWS);
  for (let band = 0; band < ROWS; band++) {
    let sum = 0;
    let n = 0;
    for (let y = Math.floor((band * height) / ROWS); y < Math.floor(((band + 1) * height) / ROWS); y += 2) {
      for (let x = 0; x < width; x += 3) {
        const i = (y * width + x) * 4;
        sum += L([data[i], data[i + 1], data[i + 2]]);
        n++;
      }
    }
    rows[band] = n ? sum / n : 50;
  }
  return rows;
}

function bandLightness(rows, from, to) {
  const a = Math.floor(from * ROWS);
  const b = Math.max(a + 1, Math.ceil(to * ROWS));
  let sum = 0;
  for (let i = a; i < b; i++) sum += rows[i];
  return sum / (b - a);
}

// Lettering inks for a photo poster: the lightest or darkest of its own inks, whichever
// stands out against the part of the photo the words sit on.
// Bands (the banner and bottom layouts) stay cream with dark words, like the drawn posters.
// `art` is { inks, rows }; without it (photo still loading) the time of day's own inks are used.
export function letteringInks(art, time, layout = 'top') {
  const p = PALETTES[time] ?? PALETTES.alpenglow;
  if (!art) return p;
  const sorted = [...art.inks].sort((a, b) => L(a) - L(b));
  const dark = toHex(sorted[0]);
  const light = toHex(sorted.at(-1));
  const on = (from, to) => (bandLightness(art.rows, from, to) > 55 ? dark : light);
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

// Moves the framing by (dx, dy), given as fractions of the poster's width and height (dragging
// the picture right shows more of the photo's left side). The centre is kept where the crop
// still fits inside the photo, so dragging past an edge doesn't store an unreachable position.
export function panCrop(photoWidth, photoHeight, crop, dx, dy) {
  const r = cropRect(photoWidth, photoHeight, crop);
  const cx = (r.left + r.width / 2 - dx * r.width) / photoWidth;
  const cy = (r.top + r.height / 2 - dy * r.height) / photoHeight;
  const halfW = r.width / 2 / photoWidth;
  const halfH = r.height / 2 / photoHeight;
  return {
    ...crop,
    x: Math.min(1 - halfW, Math.max(halfW, cx)),
    y: Math.min(1 - halfH, Math.max(halfH, cy)),
  };
}

// Browser only: the cropped photo (an <img> or ImageBitmap) as pixels, ready to posterize.
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
// art: { url, inks, rows } from the posterizer, or null while it's being made.
// raw: { url, width, height } shows the plain photo instead (used live while dragging and zooming).
export function renderPhotoPoster(recipe, art, { id = recipe.id ?? 'photo', frame = true, raw = null } = {}) {
  const p = letteringInks(art, recipe.time, letteringOf(recipe).layout);
  const paper = PALETTES[recipe.time] ?? PALETTES.alpenglow;
  let picture;
  if (raw) {
    const r = cropRect(raw.width, raw.height, recipe.photo);
    picture = `<svg x="0" y="0" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="${r.left} ${r.top} ${r.width} ${r.height}" preserveAspectRatio="none">` +
      `<image href="${raw.url}" width="${raw.width}" height="${raw.height}"/></svg>`;
  } else if (art) {
    picture = `<image href="${art.url}" x="0" y="0" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" preserveAspectRatio="none"/>`;
  } else {
    picture = `<rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" fill="${paper.sky[1]}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${escapeText(recipe.lettering?.title || 'Untitled')} poster" data-style="photo">` +
    picture +
    lettering(recipe, p, id) +
    (frame ? border(paper) : '') +
    `</svg>`;
}

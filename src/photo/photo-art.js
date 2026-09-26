import { getPhoto, putPhoto } from '../gallery-db.js';
import { PALETTES } from '../palettes.js';
import { posterize, toLab, WORK_SIZE } from './posterize.js';
import { cropToImageData, imageDataToUrl, lightnessRows, autoFrame } from './photo-poster.js';

// Photos for photo posters: kept in IndexedDB on the phone (never uploaded), turned into
// flat-ink art on demand, with the latest results remembered so typing a title doesn't redo it.

export const MAX_PHOTO_SIZE = 1600;
// The editor's preview is posterized at this size; smaller images (gallery thumbnails) reuse it.
export const PREVIEW_SIZE = { width: 800, height: 1200 };

export class PhotoError extends Error {}

const newPhotoId = () => `ph-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;

// A first framing for a photo (an <img>, ImageBitmap or canvas): centred on its main peak.
export function suggestFrame(source) {
  const width = source.naturalWidth ?? source.width;
  const height = source.naturalHeight ?? source.height;
  const scale = Math.min(1, WORK_SIZE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const poster = posterize(ctx.getImageData(0, 0, canvas.width, canvas.height), { colors: 5, inks: 'photo', antialias: false });
  return autoFrame(poster.labels, poster.inks.map((c) => toLab(...c)[0]), width, height);
}

// A picked file → a smaller JPEG saved on the phone. Returns its id and a first framing ({ x, y }).
export async function importPhoto(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file); // Chrome turns the photo upright from its camera tags.
  } catch {
    throw new PhotoError("Couldn't open that photo. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new PhotoError("Couldn't open that photo. Try a JPEG or PNG.");
  let frame = { x: 0.5, y: 0.5 };
  try { frame = suggestFrame(canvas); } catch { /* keep it centred */ }
  const id = newPhotoId();
  await putPhoto({ id, blob });
  return { id, x: frame.x, y: frame.y };
}

// id → Promise of { bitmap, url, width, height } (url is for showing the plain photo while dragging).
const photos = new Map();
const ready = new Map();

export function loadPhoto(id) {
  if (!photos.has(id)) {
    const job = getPhoto(id).then(async (entry) => {
      if (!entry?.blob) throw new PhotoError('That photo is no longer on this phone.');
      const bitmap = await createImageBitmap(entry.blob);
      const photo = { bitmap, url: URL.createObjectURL(entry.blob), width: bitmap.width, height: bitmap.height };
      ready.set(id, photo);
      return photo;
    });
    job.catch(() => photos.delete(id));
    photos.set(id, job);
  }
  return photos.get(id);
}

// The photo, if it has already been loaded.
export const loadedPhoto = (id) => ready.get(id) ?? null;

const artKey = (recipe, width, height) => {
  const { id, x, y, zoom, colors, inks } = recipe.photo;
  return [id, x.toFixed(4), y.toFixed(4), zoom.toFixed(3), colors, inks, inks === 'poster' ? recipe.time : '', width, height].join('|');
};

// Remembered results: small ones (preview size) only, newest last.
const KEEP = 6;
const art = new Map();
const finished = new Map();

function remember(key, value, map) {
  map.delete(key);
  map.set(key, value);
  while (map.size > KEEP) map.delete(map.keys().next().value);
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

// The photo poster's art at a size: { url (PNG data URL), inks, rows }.
// Anything smaller than the preview reuses the preview's art, which the SVG scales down.
export function photoArt(recipe, width = PREVIEW_SIZE.width, height = PREVIEW_SIZE.height) {
  if (width <= PREVIEW_SIZE.width && height <= PREVIEW_SIZE.height) ({ width, height } = PREVIEW_SIZE);
  const key = artKey(recipe, width, height);
  if (art.has(key)) return art.get(key);
  const { photo, time } = recipe;
  const job = loadPhoto(photo.id).then(async ({ bitmap }) => {
    await nextFrame(); // let the page show "Making poster…" before the work starts
    // The photo is read at the posterizer's working size, so every size of poster gets the same shapes.
    const pixels = cropToImageData(bitmap, photo, Math.round((WORK_SIZE * width) / height), WORK_SIZE);
    const poster = posterize(pixels, { colors: photo.colors, inks: photo.inks, palette: PALETTES[time], seed: 1, width, height });
    const result = { url: imageDataToUrl(poster), inks: poster.inks, rows: lightnessRows(poster) };
    if (key.endsWith(`|${PREVIEW_SIZE.width}|${PREVIEW_SIZE.height}`)) remember(key, result, finished);
    return result;
  });
  const small = width === PREVIEW_SIZE.width && height === PREVIEW_SIZE.height;
  if (small) {
    remember(key, job, art);
    job.catch(() => art.delete(key));
  }
  return job;
}

// The preview art if it's already made, else null. Never waits.
export const cachedArt = (recipe) => (recipe.photo ? finished.get(artKey(recipe, PREVIEW_SIZE.width, PREVIEW_SIZE.height)) ?? null : null);

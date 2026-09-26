import { PEAK_KINDS } from './layers/mountains.js';
import { PALETTES } from './palettes.js';
import { SCENERY, sceneryOf } from './scene.js';
import { TYPEFACES, LAYOUTS } from './layers/lettering.js';
import { PRINT_STYLES } from './styles/print.js';

// A poster is a small JSON "recipe". Saved posters are always passed through normalizeRecipe,
// so older or damaged recipes still open, and fields added by later versions are kept as-is.
export const SCHEMA_VERSION = 1;
export const MAX_TITLE = 24;
export const MAX_TAGLINE = 40;

export const randomSeed = () => 1 + Math.floor(Math.random() * 999998);

export function newId() {
  if (globalThis.crypto?.randomUUID) return `p-${crypto.randomUUID()}`;
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const isInt = (v) => Number.isInteger(v) && v >= 0;
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const clamp = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

// Photo posters: which photo (stored on the phone), which part of it is shown (x, y = centre,
// 0–1; zoom 1–3), how many inks (4–6) and whether they are the photo's own colours or the
// time-of-day palette's.
export const PHOTO_COLORS = [4, 5, 6];
export const PHOTO_INKS = ['photo', 'poster'];
export const MAX_ZOOM = 3;

export function normalizePhoto(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return undefined;
  return {
    id: raw.id,
    x: clamp(raw.x, 0, 1, 0.5),
    y: clamp(raw.y, 0, 1, 0.5),
    zoom: clamp(raw.zoom, 1, MAX_ZOOM, 1),
    colors: pick(raw.colors, PHOTO_COLORS, 5),
    inks: pick(raw.inks, PHOTO_INKS, 'photo'),
  };
}

export function normalizeRecipe(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const now = Date.now();
  const l = r.lettering && typeof r.lettering === 'object' ? r.lettering : {};
  const legacySpaced = l.layout === 'spaced';
  const layers = sceneryOf(r);
  const { scene: _legacyScene, photo: rawPhoto, ...rest } = r;
  const photo = normalizePhoto(rawPhoto);
  return {
    ...rest,
    ...(photo ? { photo } : {}),
    schemaVersion: SCHEMA_VERSION,
    id: typeof r.id === 'string' && r.id ? r.id : newId(),
    createdAt: isInt(r.createdAt) ? r.createdAt : now,
    updatedAt: isInt(r.updatedAt) ? r.updatedAt : now,
    seed: isInt(r.seed) ? r.seed : 1931,
    peak: pick(r.peak, PEAK_KINDS, 'spire'),
    peakSeed: isInt(r.peakSeed) ? r.peakSeed : 1,
    time: pick(r.time, Object.keys(PALETTES), 'alpenglow'),
    layers: Object.fromEntries(SCENERY.map((name) => [name, Boolean(layers[name])])),
    lettering: {
      title: typeof l.title === 'string' ? l.title.slice(0, MAX_TITLE) : '',
      tagline: typeof l.tagline === 'string' ? l.tagline.slice(0, MAX_TAGLINE) : '',
      layout: legacySpaced ? 'top' : pick(l.layout, LAYOUTS, 'top'),
      font: TYPEFACES[l.font] ? l.font : (legacySpaced ? 'josefin' : 'limelight'),
    },
    style: pick(r.style, PRINT_STYLES, 'flat'),
  };
}

// A fresh poster, ready for the owner to name.
export function createRecipe(overrides = {}) {
  return normalizeRecipe({
    seed: randomSeed(),
    peak: 'spire',
    peakSeed: randomSeed(),
    time: 'alpenglow',
    layers: { village: true, forest: true },
    lettering: { title: 'Destination', tagline: 'Your tagline here', layout: 'top', font: 'limelight' },
    style: 'flat',
    ...overrides,
    id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  });
}

// A copy that is its own poster (new id and dates).
export function duplicateRecipe(recipe) {
  const copy = structuredClone(recipe);
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  copy.lettering = { ...copy.lettering };
  return normalizeRecipe(copy);
}

// "Surprise me": a whole new look for the poster (mountain, sky, scenery, lettering style and
// print finish). The owner's destination and tagline are kept. A photo poster keeps its photo and
// framing, and gets new inks, time of day and lettering style instead.
export function surpriseRecipe(recipe, random = Math.random) {
  const choose = (list) => list[Math.floor(random() * list.length)];
  if (recipe.photo) {
    return normalizeRecipe({
      ...recipe,
      time: choose(Object.keys(PALETTES)),
      photo: { ...recipe.photo, colors: choose(PHOTO_COLORS), inks: choose(PHOTO_INKS) },
      lettering: { ...recipe.lettering, font: choose(Object.keys(TYPEFACES)), layout: choose(LAYOUTS) },
    });
  }
  const seed = () => 1 + Math.floor(random() * 999998);
  const layers = Object.fromEntries(SCENERY.map((name) => [name, random() < 0.4]));
  if (!SCENERY.some((name) => layers[name])) layers[choose(SCENERY)] = true;
  return normalizeRecipe({
    ...recipe,
    seed: seed(),
    peak: choose(PEAK_KINDS),
    peakSeed: seed(),
    time: choose(Object.keys(PALETTES)),
    layers,
    lettering: { ...recipe.lettering, font: choose(Object.keys(TYPEFACES)), layout: choose(LAYOUTS) },
    style: choose(PRINT_STYLES),
  });
}

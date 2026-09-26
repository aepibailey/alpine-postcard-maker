import { listPosters, getPoster, putPoster, deletePoster, keepStorage } from './gallery-db.js';
import { normalizeRecipe, createRecipe, duplicateRecipe } from './recipe.js';
import { exportPoster } from './export.js';

// Keeps the gallery in step with the editor. Every edit is written at once to a small local
// "mirror" (so nothing is lost if the phone kills the app), then saved into the gallery shortly after.
const CURRENT_MIRROR = 'apm.mirror';
const LEGACY_EDITOR = 'apm.editor'; // where versions before 0.8 kept the single poster

const readJson = (key) => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};

export async function thumbnailFor(recipe) {
  try {
    return await exportPoster(recipe, { width: 240, height: 360, type: 'image/jpeg', quality: 0.82 });
  } catch {
    return null;
  }
}

// Saves are queued one after another, and a save never replaces a newer copy of the same poster
// (a slow preview image for an old edit can't overwrite a later edit).
let queue = Promise.resolve();

function saveEntry(recipe, thumbnail) {
  const job = queue.then(async () => {
    const existing = await getPoster(recipe.id);
    if (existing && existing.updatedAt > recipe.updatedAt) return existing;
    const entry = {
      id: recipe.id,
      recipe,
      thumbnail: thumbnail ?? existing?.thumbnail ?? null,
      updatedAt: recipe.updatedAt,
    };
    await putPoster(entry);
    keepStorage().catch(() => {});
    return entry;
  });
  queue = job.catch(() => {});
  return job;
}

// Attach a preview image, but only if the poster hasn't been edited since.
function attachThumbnail(recipe, thumbnail) {
  const job = queue.then(async () => {
    const existing = await getPoster(recipe.id);
    if (thumbnail && existing && existing.updatedAt === recipe.updatedAt) await putPoster({ ...existing, thumbnail });
  });
  queue = job.catch(() => {});
  return job;
}

export async function addPoster(recipe) {
  const r = normalizeRecipe(recipe);
  const entry = await saveEntry(r, null);
  // The preview image can follow a moment later; the poster itself is already safe.
  thumbnailFor(r).then((thumbnail) => attachThumbnail(r, thumbnail)).catch(() => {});
  return entry;
}

// Which poster to show when the app opens.
export async function startingPoster() {
  const mirror = readJson(CURRENT_MIRROR);
  if (mirror) {
    // The mirror holds the latest edit even if the app was closed before it reached the gallery.
    const recipe = normalizeRecipe(mirror);
    const saved = await getPoster(recipe.id);
    if (!saved || recipe.updatedAt > saved.updatedAt) await addPoster(recipe);
    return recipe;
  }
  const posters = await listPosters();
  if (posters.length) return normalizeRecipe(posters[0].recipe);
  // First run of the gallery: bring over the poster from earlier versions, or start fresh.
  const legacy = readJson(LEGACY_EDITOR);
  const recipe = legacy ? normalizeRecipe({ ...legacy, seed: 1931 }) : createRecipe();
  await addPoster(recipe);
  try { localStorage.removeItem(LEGACY_EDITOR); } catch { /* ignore */ }
  return recipe;
}

let pending = null;
let timer = null;

async function flushNow({ withThumbnail = true } = {}) {
  clearTimeout(timer);
  const recipe = pending;
  pending = null;
  if (!recipe) return null;
  const entry = await saveEntry(recipe, null);
  if (withThumbnail) await attachThumbnail(recipe, await thumbnailFor(recipe));
  return entry;
}

// Called after every edit in the editor.
export function edited(recipe, onSaved = () => {}) {
  const stamped = { ...structuredClone(recipe), updatedAt: Date.now() };
  writeJson(CURRENT_MIRROR, stamped);
  pending = stamped;
  clearTimeout(timer);
  timer = setTimeout(() => flushNow().then((entry) => entry && onSaved(entry)).catch(() => {}), 600);
}

// Save immediately (e.g. before switching poster or when the app goes to the background).
export const flush = (options) => flushNow(options);

export function setCurrent(recipe) {
  writeJson(CURRENT_MIRROR, recipe);
}

export async function duplicatePoster(id) {
  const entry = await getPoster(id);
  if (!entry) return null;
  return saveEntry(duplicateRecipe(entry.recipe), entry.thumbnail);
}

export async function removePoster(id) {
  await deletePoster(id);
}

export { listPosters, getPoster, putPoster };

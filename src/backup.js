import { normalizeRecipe } from './recipe.js';

// A backup is one JSON file holding every poster (recipe + small preview image) and, since
// version 2, the photos that photo posters use (so backups with photos are bigger).
export const BACKUP_FORMAT = 'alpine-postcard-maker-backup';
export const BACKUP_VERSION = 2;

export async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export async function dataUrlToBlob(url) {
  return (await fetch(url)).blob();
}

// photoFor(id) → the photo's Blob (or null if it's gone).
export async function makeBackup(entries, now = new Date(), photoFor = async () => null) {
  const posters = await Promise.all(entries.map(async (entry) => ({
    recipe: entry.recipe,
    thumbnail: entry.thumbnail instanceof Blob ? await blobToDataUrl(entry.thumbnail) : null,
  })));
  const ids = [...new Set(entries.map((e) => e.recipe?.photo?.id).filter(Boolean))];
  const photos = [];
  for (const id of ids) {
    const blob = await photoFor(id);
    if (blob instanceof Blob) photos.push({ id, dataUrl: await blobToDataUrl(blob) });
  }
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), posters, photos });
}

export function backupFileName(now = new Date()) {
  return `alpine-posters-backup-${now.toISOString().slice(0, 10)}.json`;
}

const isPhotoData = (url) => typeof url === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(url);

// Reads a backup file's text → { posters: [{ recipe, thumbnail }], photos: [{ id, dataUrl }] }.
// Version 1 backups simply have no photos. Throws a friendly error for anything else.
export function readBackup(text) {
  const posters = parseBackup(text);
  const data = JSON.parse(text);
  const photos = (Array.isArray(data.photos) ? data.photos : [])
    .filter((p) => p && typeof p.id === 'string' && p.id && isPhotoData(p.dataUrl))
    .map((p) => ({ id: p.id, dataUrl: p.dataUrl }));
  return { posters, photos };
}

// Reads a backup file's text → [{ recipe, thumbnail }]. Throws a friendly error for anything else.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a poster backup.');
  }
  if (data?.format !== BACKUP_FORMAT || !Array.isArray(data.posters)) throw new Error('That file is not a poster backup.');
  return data.posters
    .filter((p) => p && typeof p.recipe === 'object')
    .map((p) => ({
      recipe: normalizeRecipe(p.recipe),
      thumbnail: typeof p.thumbnail === 'string' && p.thumbnail.startsWith('data:image/') ? p.thumbnail : null,
    }));
}

// Decide what a restore changes: new posters are added, newer copies replace older ones,
// and nothing already on the phone is ever lost or overwritten by an older copy.
// Photos are brought over when a poster being written uses one the phone doesn't have.
export function planRestore(existing, incoming, photos = [], photoIdsOnPhone = []) {
  const current = new Map(existing.map((e) => [e.id, e.updatedAt]));
  const plan = { write: [], photos: [], added: 0, updated: 0, unchanged: 0 };
  for (const item of incoming) {
    const have = current.get(item.recipe.id);
    if (have === undefined) plan.added++;
    else if (item.recipe.updatedAt > have) plan.updated++;
    else { plan.unchanged++; continue; }
    plan.write.push(item);
  }
  const have = new Set(photoIdsOnPhone);
  const needed = new Set(plan.write.map((item) => item.recipe.photo?.id).filter((id) => id && !have.has(id)));
  plan.photos = photos.filter((p) => needed.has(p.id));
  return plan;
}

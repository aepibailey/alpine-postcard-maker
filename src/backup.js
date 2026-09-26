import { normalizeRecipe } from './recipe.js';

// A backup is one JSON file holding every poster (recipe + small preview image).
export const BACKUP_FORMAT = 'alpine-postcard-maker-backup';

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export async function dataUrlToBlob(url) {
  return (await fetch(url)).blob();
}

export async function makeBackup(entries, now = new Date()) {
  const posters = await Promise.all(entries.map(async (entry) => ({
    recipe: entry.recipe,
    thumbnail: entry.thumbnail instanceof Blob ? await blobToDataUrl(entry.thumbnail) : null,
  })));
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), posters });
}

export function backupFileName(now = new Date()) {
  return `alpine-posters-backup-${now.toISOString().slice(0, 10)}.json`;
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
export function planRestore(existing, incoming) {
  const current = new Map(existing.map((e) => [e.id, e.updatedAt]));
  const plan = { write: [], added: 0, updated: 0, unchanged: 0 };
  for (const item of incoming) {
    const have = current.get(item.recipe.id);
    if (have === undefined) plan.added++;
    else if (item.recipe.updatedAt > have) plan.updated++;
    else { plan.unchanged++; continue; }
    plan.write.push(item);
  }
  return plan;
}

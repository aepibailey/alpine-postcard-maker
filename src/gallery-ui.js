import * as store from './store.js';
import { createRecipe, normalizeRecipe } from './recipe.js';
import { makeBackup, parseBackup, planRestore, backupFileName, dataUrlToBlob } from './backup.js';
import { downloadFile } from './export.js';
import { isStorageKept } from './gallery-db.js';

const $ = (id) => document.getElementById(id);
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const titleOf = (recipe) => recipe.lettering?.title?.trim() || 'Untitled';

// Tabs, the gallery grid, New / Duplicate / Delete, and Back up / Restore.
export async function startGallery(editor) {
  const editView = $('edit-view');
  const galleryView = $('gallery-view');
  const editTab = $('edit-tab');
  const galleryTab = $('gallery-tab');
  const grid = $('gallery-grid');
  const status = $('gallery-status');
  const count = $('gallery-count');
  const restoreInput = $('restore-input');
  let urls = [];

  function show(view) {
    const gallery = view === 'gallery';
    galleryView.hidden = !gallery;
    editView.hidden = gallery;
    editTab.setAttribute('aria-selected', String(!gallery));
    galleryTab.setAttribute('aria-selected', String(gallery));
    window.scrollTo(0, 0);
    // Save any edit still waiting, so the gallery shows it.
    if (gallery) store.flush().finally(refresh);
  }

  async function refresh() {
    const posters = await store.listPosters();
    count.textContent = String(posters.length);
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    const currentId = editor.current()?.id;
    grid.innerHTML = posters.map((entry) => {
      const url = entry.thumbnail instanceof Blob ? URL.createObjectURL(entry.thumbnail) : '';
      if (url) urls.push(url);
      const title = escape(titleOf(entry.recipe));
      const date = new Date(entry.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      return `<article class="card${entry.id === currentId ? ' current' : ''}" data-id="${escape(entry.id)}">` +
        `<button type="button" class="card-open" data-action="open" aria-label="Open ${title}">` +
          (url ? `<img src="${url}" alt="">` : '<span class="card-placeholder">⛰</span>') + `</button>` +
        `<div class="card-meta"><strong>${title}</strong><small>${date}${entry.id === currentId ? ' · editing' : ''}</small></div>` +
        `<div class="card-actions">` +
          `<button type="button" data-action="duplicate" aria-label="Duplicate ${title}">Copy</button>` +
          `<button type="button" data-action="delete" aria-label="Delete ${title}">Delete</button>` +
        `</div></article>`;
    }).join('') || '<p class="empty">No posters yet. Tap <strong>+ New</strong> to make one.</p>';
    const kept = await isStorageKept().catch(() => false);
    $('storage-status').textContent = kept
      ? 'Your gallery is stored safely on this phone.'
      : 'Your gallery is on this phone. Make a backup now and then, just in case.';
  }

  async function open(id) {
    await store.flush();
    const entry = await store.getPoster(id);
    if (!entry) return;
    const recipe = normalizeRecipe(entry.recipe);
    store.setCurrent(recipe);
    editor.load(recipe);
    show('edit');
  }

  async function newPoster() {
    await store.flush();
    const recipe = createRecipe();
    await store.addPoster(recipe);
    store.setCurrent(recipe);
    editor.load(recipe);
    show('edit');
  }

  grid.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    const card = event.target.closest('.card');
    if (!button || !card) return;
    const id = card.dataset.id;
    const title = card.querySelector('strong').textContent;
    if (button.dataset.action === 'open') return open(id);
    await store.flush();
    if (button.dataset.action === 'duplicate') {
      await store.duplicatePoster(id);
      status.textContent = `Copied “${title}”.`;
    } else if (button.dataset.action === 'delete') {
      if (!confirm(`Delete “${title}”? This can't be undone.`)) return;
      await store.removePoster(id);
      status.textContent = `Deleted “${title}”.`;
      if (id === editor.current()?.id) {
        const [next] = await store.listPosters();
        const recipe = next ? normalizeRecipe(next.recipe) : createRecipe();
        if (!next) await store.addPoster(recipe);
        store.setCurrent(recipe);
        editor.load(recipe);
      }
    }
    refresh();
  });

  $('backup-button').addEventListener('click', async () => {
    await store.flush();
    const posters = await store.listPosters();
    const json = await makeBackup(posters);
    downloadFile(new File([json], backupFileName(), { type: 'application/json' }));
    status.textContent = `Backed up ${posters.length} poster${posters.length === 1 ? '' : 's'} to your Downloads.`;
  });

  $('restore-button').addEventListener('click', () => restoreInput.click());
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = '';
    if (!file) return;
    try {
      const incoming = parseBackup(await file.text());
      const plan = planRestore(await store.listPosters(), incoming);
      for (const item of plan.write) {
        const thumbnail = item.thumbnail ? await dataUrlToBlob(item.thumbnail) : await store.thumbnailFor(item.recipe);
        await store.putPoster({ id: item.recipe.id, recipe: item.recipe, thumbnail, updatedAt: item.recipe.updatedAt });
      }
      status.textContent = `Restored: ${plan.added} added, ${plan.updated} updated, ${plan.unchanged} already here.`;
    } catch (error) {
      status.textContent = error.message;
    }
    refresh();
  });

  editTab.addEventListener('click', () => show('edit'));
  galleryTab.addEventListener('click', () => show('gallery'));
  $('new-button').addEventListener('click', newPoster);

  const posters = await store.listPosters();
  count.textContent = String(posters.length);
  return { refresh, updateCount: async () => { count.textContent = String((await store.listPosters()).length); } };
}

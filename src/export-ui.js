import { EXPORT_SIZES, sizeFor, exportPoster, fileName, shareFile, downloadFile } from './export.js';

const STORE_KEY = 'apm.exportSize';

function loadSize() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    return EXPORT_SIZES[saved] ? saved : 'screen';
  } catch {
    return 'screen';
  }
}

// Size picker plus Share / Save buttons. `getRecipe` returns the poster currently in the editor.
export function startExport(getRecipe) {
  const picker = document.getElementById('size-picker');
  const shareButton = document.getElementById('share-button');
  const saveButton = document.getElementById('save-button');
  const status = document.getElementById('export-status');
  let size = loadSize();

  picker.innerHTML = Object.entries(EXPORT_SIZES).map(([key, s]) => {
    const { width, height } = sizeFor(key);
    return `<button type="button" role="radio" data-value="${key}" aria-label="${s.label}">` +
      `<span>${s.label}</span><small>${width} × ${height}</small></button>`;
  }).join('');
  const buttons = [...picker.querySelectorAll('button')];

  function show() {
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.value === size));
  }

  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    size = button.dataset.value;
    try { localStorage.setItem(STORE_KEY, size); } catch { /* ignore */ }
    show();
  });

  async function makeFile() {
    const recipe = getRecipe();
    const { width, height } = sizeFor(size);
    const blob = await exportPoster(recipe, { width, height });
    return new File([blob], fileName(recipe, size), { type: 'image/png' });
  }

  async function run(action) {
    shareButton.disabled = saveButton.disabled = true;
    status.textContent = 'Preparing your poster…';
    try {
      const file = await makeFile();
      if (action === 'share' && await shareFile(file, getRecipe().lettering?.title || 'Alpine poster')) {
        status.textContent = 'Shared.';
      } else {
        downloadFile(file);
        status.textContent = `Saved ${file.name} to your Downloads.`;
      }
    } catch (error) {
      status.textContent = `Sorry, the image could not be made (${error.message}).`;
    } finally {
      shareButton.disabled = saveButton.disabled = false;
    }
  }

  shareButton.addEventListener('click', () => run('share'));
  saveButton.addEventListener('click', () => run('save'));
  show();
}

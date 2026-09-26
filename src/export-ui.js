import { EXPORT_SIZES, FITS, sizeFor, exportPoster, fileName, shareFile, downloadFile } from './export.js';

const STORE_KEY = 'apm.exportSize';
const FIT_KEY = 'apm.exportFit';

function load(key, valid, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return valid[saved] ? saved : fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// Size picker plus Share / Save buttons. `getRecipe` returns the poster currently in the editor.
export function startExport(getRecipe) {
  const picker = document.getElementById('size-picker');
  const shareButton = document.getElementById('share-button');
  const saveButton = document.getElementById('save-button');
  const status = document.getElementById('export-status');
  const fitPicker = document.getElementById('fit-picker');
  let size = load(STORE_KEY, EXPORT_SIZES, 'screen');
  let fit = load(FIT_KEY, FITS, 'mat');

  picker.innerHTML = Object.entries(EXPORT_SIZES).map(([key, s]) => {
    const { width, height } = sizeFor(key);
    return `<button type="button" role="radio" data-value="${key}" aria-label="${s.label}">` +
      `<span>${s.label}</span><small>${width} × ${height}</small></button>`;
  }).join('');
  const buttons = [...picker.querySelectorAll('button')];
  fitPicker.innerHTML = Object.entries(FITS).map(([key, label]) =>
    `<button type="button" role="radio" data-value="${key}">${label}</button>`).join('');
  const fitButtons = [...fitPicker.querySelectorAll('button')];

  function show() {
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.value === size));
    for (const b of fitButtons) b.setAttribute('aria-checked', String(b.dataset.value === fit));
    // The 10×15 print is already the poster's shape, so mat or fill makes no difference there.
    fitPicker.classList.toggle('muted', size === 'print');
  }

  fitPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    fit = button.dataset.value;
    store(FIT_KEY, fit);
    show();
  });

  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    size = button.dataset.value;
    store(STORE_KEY, size);
    show();
  });

  async function makeFile() {
    const recipe = getRecipe();
    const { width, height } = sizeFor(size);
    const blob = await exportPoster(recipe, { width, height, fit });
    return new File([blob], fileName(recipe, fit === 'fill' && size !== 'print' ? `${size}-fill` : size), { type: 'image/png' });
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

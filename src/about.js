import { VERSION } from './version.js';
import { listPosters } from './gallery-db.js';

const WELCOMED = 'apm.welcomed';

// First-run welcome card; it stays away once the owner taps "Got it".
export function startWelcome() {
  const card = document.getElementById('welcome');
  let seen = false;
  try { seen = localStorage.getItem(WELCOMED) === '1'; } catch { /* ignore */ }
  card.hidden = seen;
  document.getElementById('welcome-button').addEventListener('click', () => {
    card.hidden = true;
    try { localStorage.setItem(WELCOMED, '1'); } catch { /* ignore */ }
    document.getElementById('surprise-button').focus();
  });
}

const size = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

async function storageText() {
  const posters = await listPosters().catch(() => []);
  const count = `${posters.length} poster${posters.length === 1 ? '' : 's'} in your gallery`;
  const kept = await (navigator.storage?.persisted?.() ?? false);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const used = estimate?.usage ? `, using about ${size(estimate.usage)}` : '';
  const safety = kept
    ? 'Chrome has agreed to keep them even when the phone runs low on space.'
    : 'Chrome may clear them if the phone runs very low on space, so make a backup now and then.';
  return `${count}${used}. ${safety}`;
}

// The About panel: version, art and privacy notes, storage status and font credits.
export function startAbout() {
  const dialog = document.getElementById('about-dialog');
  document.getElementById('about-version').textContent = VERSION;
  document.getElementById('about-button').addEventListener('click', async () => {
    dialog.showModal();
    const storage = document.getElementById('about-storage');
    storage.textContent = await storageText().catch(() => 'Could not check storage.');
  });
  // Tapping outside the panel closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

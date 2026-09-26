import { VERSION } from './version.js';
import { startEditor } from './editor.js';
import { startExport } from './export-ui.js';
import { startGallery } from './gallery-ui.js';
import * as store from './store.js';

document.getElementById('app-version').textContent = VERSION;

async function startApp() {
  let gallery;
  const editor = startEditor({ onChange: (recipe) => store.edited(recipe, () => gallery?.updateCount()) });
  editor.load(await store.startingPoster());
  startExport(() => editor.current());
  gallery = await startGallery(editor);
  // Save straight away if the app is sent to the background or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.flush({ withThumbnail: false });
  });
  document.body.dataset.ready = 'true';
}

startApp().catch((error) => {
  document.getElementById('offline-status').textContent = `Something went wrong starting the app: ${error.message}`;
});

const status = document.getElementById('offline-status');
const banner = document.getElementById('update-banner');

function showUpdateBanner(worker) {
  banner.hidden = false;
  document.getElementById('update-button').onclick = () => {
    worker.postMessage('SKIP_WAITING');
  };
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'Offline mode is not supported in this browser.';
    return;
  }

  // Only reload for an update, not for the very first install.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });

  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateBanner(registration.waiting);
  }
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner(installing);
      }
    });
  });

  await navigator.serviceWorker.ready;
  status.textContent = 'Ready to work offline.';
}

registerServiceWorker().catch(() => {
  status.textContent = 'Offline mode could not be set up.';
});

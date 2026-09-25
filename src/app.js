import { VERSION } from './version.js';
import { SAMPLES } from './samples.js';
import { renderPoster } from './poster.js';

document.getElementById('app-version').textContent = VERSION;

function showSamples() {
  const carousel = document.getElementById('carousel');
  carousel.innerHTML = SAMPLES
    .map((recipe, i) => `<figure class="poster-frame" data-index="${i}">${renderPoster(recipe)}</figure>`)
    .join('');
  const hint = document.getElementById('carousel-hint');
  const frames = [...carousel.children];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) hint.textContent = `${Number(entry.target.dataset.index) + 1} of ${frames.length} · swipe for more`;
    }
  }, { root: carousel, threshold: 0.6 });
  frames.forEach((frame) => observer.observe(frame));
}

showSamples();

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

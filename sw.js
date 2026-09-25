// Bump CACHE together with src/version.js whenever any precached file changes.
const CACHE = 'apm-0.3.0';

// Relative to the service worker's location, so it works under /alpine-postcard-maker/.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/app.css',
  'src/fonts.css',
  'src/app.js',
  'src/version.js',
  'src/rng.js',
  'src/palettes.js',
  'src/svg.js',
  'src/poster.js',
  'src/samples.js',
  'src/editor.js',
  'src/layers/sky.js',
  'src/layers/mountains.js',
  'src/layers/ridgeline.js',
  'src/layers/scenery.js',
  'src/layers/lettering.js',
  'src/layers/border.js',
  'fonts/Limelight-Regular.woff2',
  'fonts/Limelight-OFL.txt',
  'fonts/JosefinSans-Variable.woff2',
  'fonts/JosefinSans-OFL.txt',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        if (request.mode === 'navigate') return caches.match('index.html');
        throw new Error(`Offline and not cached: ${request.url}`);
      });
    })
  );
});

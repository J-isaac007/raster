// Raster service worker: makes the app work offline.
//
// Pages are network-first (so updates show up on the next load), everything
// else is cache-first. Vite gives built assets hashed names, so a cached
// asset never goes stale; old ones are dropped when the cache version changes.

const CACHE = 'raster-v2';

// The page's scripts and styles load before this worker exists, so read their
// hashed names from index.html and cache them up front. Otherwise the very
// first visit would not work offline.
async function precache() {
  const cache = await caches.open(CACHE);
  const html = await (await fetch('./', { cache: 'no-store' })).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.?\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll([
    './',
    './manifest.webmanifest',
    './favicon.svg',
    './icon-192.png',
    './icon-512.png',
    ...assets,
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

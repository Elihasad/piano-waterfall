const CACHE_NAME = 'piano-waterfall-v1.3.24';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const coreAssets = [
        './',
        './index.html',
        './icon.svg',
        './manifest.webmanifest',
        './catalog/public-domain-catalog.json',
      ];
      await cache.addAll(coreAssets);
      try {
        const res = await fetch('./index.html', { cache: 'no-store' });
        if (res.ok) {
          const html = await res.text();
          const assetMatches = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map(
            (m) => (m[1].startsWith('./') || m[1].startsWith('/') ? m[1] : `./${m[1]}`),
          );
          if (assetMatches.length > 0) {
            await cache.addAll(assetMatches);
          }
        }
      } catch {
        // Offline install fallback
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-First for HTML navigations so deployed updates reach users
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html'))),
    );
    return;
  }

  // Cache-First for hashed JS/CSS/icon assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    }),
  );
});

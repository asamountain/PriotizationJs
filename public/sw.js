// App-shell cache so the UI paints instantly on repeat visits while the
// (possibly still-waking) server catches up in the background over
// socket.io/API calls. Bump CACHE_NAME whenever this file changes so old
// clients purge their cache instead of serving a stale skeleton forever.
const CACHE_NAME = 'ptm-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/app.js',
  '/taskManager.js',
  '/style.css',
  '/css/chart-styles.css',
  '/js/app-init.js',
  '/manifest.json',
  '/icon.svg'
];

// The app is under active development — the HTML shell and its main
// scripts change constantly, so they must always reflect the live
// deploy rather than a cached snapshot. Only fall back to cache when
// the network is actually unreachable (offline / mid cold-start).
const NETWORK_FIRST_PATHS = new Set(['/', '/app.js', '/taskManager.js', '/js/app-init.js']);

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDN scripts/fonts pass through untouched
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/socket.io/')) return;

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // Everything else (icons, manifest, css): stale-while-revalidate is fine
  // since it rarely changes and instant paint matters more there.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

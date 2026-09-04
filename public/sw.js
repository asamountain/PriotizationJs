// App-shell cache so the UI paints instantly on repeat visits while the
// (possibly still-waking) server catches up in the background over
// socket.io/API calls. Bump CACHE_NAME when the shell markup changes shape
// so old clients don't get served a stale skeleton indefinitely.
const CACHE_NAME = 'ptm-shell-v1';
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

  // Stale-while-revalidate: serve cached shell immediately, refresh in the background.
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

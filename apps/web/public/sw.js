// Hand-written service worker (no next-pwa/serwist/workbox) — see the
// offline-mode plan: Next 16 builds with Turbopack by default and fails if it
// finds an unexpected webpack config, which is exactly what those plugins add.
//
// Next.js App Router build output has content-hashed JS/CSS chunk filenames
// that aren't known ahead of time, so this SW doesn't try to precache a
// hardcoded asset manifest. Instead it uses runtime caching: the first time a
// route/asset is fetched successfully (while online), it's cached; later
// offline loads are served from that cache. Visiting the billing/orders
// screens once online is what "warms" them for offline use.
//
// API calls (/api/*, /api-proxy/*) are deliberately left untouched here — the
// app's own offline-store.ts queues those in IndexedDB when they fail. This
// SW only exists to make the app shell (HTML/JS/CSS) load without a network.

const CACHE_NAME = 'orderflow-shell-v2';
const CORE_ROUTES = ['/dashboard', '/orders', '/billing', '/orders/takeaway'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        CORE_ROUTES.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/api-proxy/') || url.pathname.startsWith('/uploads/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/dashboard'))),
    );
    return;
  }

  // Static assets (JS/CSS/fonts/images) — stale-while-revalidate: answer from
  // cache immediately when present (so this works offline), but always also
  // fetch a fresh copy in the background so the cache can't get stuck on a
  // stale bundle forever. Pure cache-first would be fine for Next's
  // content-hashed prod chunks (same URL == same content forever), but dev
  // builds can reuse the same chunk URL for different content across
  // restarts, and a plain cache-first SW would silently keep serving old code.
  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    const network = fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => undefined);
    // Keep the background revalidation alive even after respondWith's promise
    // settles — without this the browser can tear the worker down mid-fetch.
    event.waitUntil(network);
    event.respondWith(caches.match(request).then((cached) => cached || network));
  }
});

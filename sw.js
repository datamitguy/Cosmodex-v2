/* Cosmodex v2 — service worker (offline shell load).
   Strategy: network-revalidate-first for same-origin GETs, cache only as an
   OFFLINE fallback. The fetch bypasses the HTTP cache (cache:'no-cache') so a
   fresh deploy is never masked by a stale styles.css/app.js — the previous
   version silently served post-deploy stale assets. Cross-origin (Firebase,
   Google auth, fonts) and non-GET requests pass straight through. */
const CACHE = 'cosmodex-shell-v3';
const CORE = ['./', './cosmodex-v2.html', './app.js', './styles.css'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Pre-cache fresh copies (cache:'reload' bypasses the HTTP cache).
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(CORE.map(u => fetch(new Request(u, { cache: 'reload' }))
      .then(res => res.ok && c.put(u, res)).catch(() => {})))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // Revalidate against the server every time; only fall back to cache offline.
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./cosmodex-v2.html')))
  );
});

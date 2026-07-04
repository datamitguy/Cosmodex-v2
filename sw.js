/* Cosmodex v2 — service worker (audit 5.3: offline shell load)
   Strategy: network-first for same-origin GETs, falling back to the cache when
   offline. This keeps deployed code fresh while the app still loads with no
   network. Cross-origin requests (Firebase, Google auth, fonts CDN) and
   non-GET requests are passed straight through, untouched. */
const CACHE = 'cosmodex-shell-v1';
const CORE = ['./', './cosmodex-v2.html', './app.js', './styles.css'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
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
    fetch(req)
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./cosmodex-v2.html')))
  );
});

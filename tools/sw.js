// Agent Tools offline cache. Bump CACHE when the core files change.
const CACHE = 'agent-tools-v4';
const CORE = [
  '/tools/',
  '/tools/manifest.webmanifest',
  '/tools/icons/icon-192.png',
  '/tools/icons/icon-512.png',
  '/tools/icons/apple-touch-icon.png',
  '/tools/icons/favicon-32.png',
  '/tools/icons/favicon.ico'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('agent-tools-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/facebook|fbevents|ipapi|visitor-badge/.test(url.href)) return;

  // pages: network first so updates show up, cached copy when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok && url.pathname === '/tools/') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/tools/', copy));
        }
        return res;
      }).catch(() => caches.match('/tools/'))
    );
    return;
  }

  // images, icons, fonts: cache first, refresh in the background
  const sameOrigin = url.origin === self.location.origin;
  const font = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !font) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

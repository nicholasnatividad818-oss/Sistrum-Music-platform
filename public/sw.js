const CACHE = 'sistrum-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('sistrum-shell-') && key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Never persist OAuth callback URLs, API responses, or arbitrary media.
  if (url.search || event.request.headers.has('Authorization')) return;
  const navigation = event.request.mode === 'navigate';
  const staticAsset = SHELL.includes(url.pathname) || url.pathname.startsWith('/assets/');
  if (!navigation && !staticAsset) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (staticAsset && response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {}));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (navigation) return (await caches.match('/')) || Response.error();
        return Response.error();
      })
  );
});

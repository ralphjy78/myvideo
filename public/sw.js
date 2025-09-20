self.addEventListener('install', (e) => self.skipWaiting())
self.addEventListener('activate', (e) => self.clients.claim())

// Basic offline fallback (optional minimal)
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  event.respondWith(fetch(req).catch(() => caches.match('/'))) // naive fallback to index
})

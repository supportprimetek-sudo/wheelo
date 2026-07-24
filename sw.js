/* ==========================================================================
   WHEELO - Service Worker for PWA (Network-First Auto Update Engine)
   ========================================================================== */

const CACHE_NAME = 'wheelo-pwa-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css?v=3.0',
  '/js/api.js?v=3.0',
  '/js/storage.js?v=3.0',
  '/js/audio.js?v=3.0',
  '/js/pricing.js?v=3.0',
  '/js/map.js?v=3.0',
  '/js/captain.js?v=3.0',
  '/js/simulation.js?v=3.0',
  '/js/app.js?v=3.0',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[PWA ServiceWorker v3] Installing & Caching Assets');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA ServiceWorker] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First strategy to guarantee users always receive latest UI updates
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

/* ==========================================================================
   WHEELO - Service Worker for PWA Mobile Offline Caching & Performance
   ========================================================================== */

const CACHE_NAME = 'wheelo-pwa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/storage.js',
  '/js/audio.js',
  '/js/pricing.js',
  '/js/map.js',
  '/js/captain.js',
  '/js/simulation.js',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA ServiceWorker] Caching App Shell & Core Assets');
      return cache.addAll(ASSETS).catch(err => console.warn('Cache add error:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Network-first for API requests
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for static shell assets
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

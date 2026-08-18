/**
 * SERVICE WORKER ENGINE - MYAIWA PWA
 * AIWA RAGIN JAJE SYSTEM
 * Version: v2.3.0
 */

const CACHE_NAME = 'myaiwa-v2.3.0';

// Aset lokal yang di-cache saat instalasi
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png'
];

// 1. INSTALASI: Unduh dan simpan aset dasar ke cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. AKTIVASI: Hapus cache versi lama secara otomatis
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH: Lewatkan permintaan live cloud, sajikan file lokal dari cache
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Jangan cache request API live: Firestore, Auth, Storage, & Library External
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('demotiles.maplibre.org') ||
    url.includes('unpkg.com') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('cdn.jsdelivr.net')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});

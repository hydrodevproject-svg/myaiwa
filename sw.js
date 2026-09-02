/**
 * SERVICE WORKER ENGINE - MYAIWA PWA
 * AIWA RAGIN JAJE SYSTEM
 * Version: v2.6.0 (Full Offline Precache & Seamless Cache Strategy)
 */

const CACHE_NAME = 'myaiwa-v2.6.0';

// DAFTAR LENGKAP BERKAS STATIS INTERNAL APLIKASI
const PRECACHE_ASSETS = [
  // 1. Root & App Shell
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',

  // 2. Modular Stylesheets (Folder css/)
  './css/01-variables.css',
  './css/02-base.css',
  './css/03-layout.css',
  './css/04-components.css',
  './css/05-forms.css',
  './css/06-modals.css',
  './css/07-print.css',

  // 3. Domain Logic Modules (Folder src/)
  './src/constants.js',
  './src/view-loader.js',
  './src/utils.js',
  './src/auth.js',
  './src/attendance.js',
  './src/tasks-kpi.js',
  './src/payroll-kasbon.js',
  './src/hr-management.js',
  './src/it-system.js',

  // 4. View Partials (Folder views/)
  './views/auth-login.html',
  './views/tab-beranda.html',
  './views/tab-tugas.html',
  './views/tab-absensi.html',
  './views/tab-gaji.html',
  './views/tab-kasbon.html',
  './views/tab-hr.html',
  './views/tab-accounting.html',
  './views/tab-users.html',
  './views/tab-it.html',
  './views/tab-profile.html',
  './views/sub-pages.html',
  './views/modals.html'
];

// 1. EVENT INSTALL: Precache Semua Berkas
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. EVENT ACTIVATE: Pembersihan Cache Versi Lama
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

// 3. EVENT FETCH: Cache-First dengan Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('demotiles.maplibre.org') ||
    url.includes('basemaps.cartocdn.com') ||
    url.includes('tile.openstreetmap.org') ||
    url.includes('openfreemap.org') ||
    url.includes('unpkg.com') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});

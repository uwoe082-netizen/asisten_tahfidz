/* ============================================================
   HAFIZ — sw.js
   Service Worker: cache-first assets, network-first Quran API
   ============================================================ */

const CACHE_VERSION = 'hafiz-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/index.css',
  './css/mushaf.css',
  './css/components.css',
  './css/animations.css',
  './js/utils.js',
  './js/storage.js',
  './js/quran-data.js',
  './js/mushaf-renderer.js',
  './js/progressive-reveal.js',
  './js/speech-engine.js',
  './js/error-marker.js',
  './js/spaced-repetition.js',
  './js/gamification.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('hafiz-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Network-first for the Quran API (fresh data, fall back to cache offline)
  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for same-origin static assets and Google Fonts
  if (url.origin === self.location.origin || url.hostname.includes('fonts.g')) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ code: 503, status: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

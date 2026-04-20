/**
 * Ghillie Service Worker v3 — subdirectory aware (/Ghillie/)
 */

const CACHE = 'ghillie-v3';
const BASE = '/Ghillie';
const SHELL = [
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  BASE + '/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([BASE + '/index.html', BASE + '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls
  if (url.hostname.includes('sepa.org.uk') ||
      url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('nominatim') ||
      url.hostname.includes('openstreetmap') ||
      url.hostname.includes('cartocdn') ||
      url.hostname.includes('api.anthropic')) {
    return;
  }

  // Navigation requests — always serve index.html (key fix for iOS standalone)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(BASE + '/index.html')
        .then(cached => cached || fetch(BASE + '/index.html'))
        .catch(() => fetch(BASE + '/index.html'))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});

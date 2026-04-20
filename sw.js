/**
 * Ghillie Service Worker v2 — robust iOS standalone support
 */

const CACHE = 'ghillie-v2';
const SHELL = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

// Install — pre-cache shell. Don't cache anything that might fail (CDN) blocking install.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/index.html', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// Activate — claim all clients immediately, delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — always serve index.html for navigation requests (critical for iOS standalone)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls — always go to network
  if (url.hostname.includes('sepa.org.uk') ||
      url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('nominatim') ||
      url.hostname.includes('api.anthropic')) {
    return;
  }

  // For navigation requests (page loads) — serve cached index.html
  // This is the key fix for iOS standalone: when launched from home screen,
  // iOS fires a navigation request to start_url. If SW isn't ready the page blanks.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html')
        .then(cached => cached || fetch('/index.html'))
        .catch(() => fetch('/index.html'))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => {
        // Fallback for failed asset loads
        if (e.request.destination === 'document') return caches.match('/index.html');
      });
    })
  );
});

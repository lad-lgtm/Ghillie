/**
 * Ghillie Service Worker — offline caching
 * Cache-first for app shell, network-first for API calls
 */

const CACHE = 'ghillie-v1';
const SHELL = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate — remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for shell assets, network-first for APIs
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept SEPA/weather API calls — always fresh
  if (url.hostname.includes('sepa.org.uk') ||
      url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('workers.dev')) {
    return; // let browser handle normally
  }

  // Cache-first for everything else (fonts, leaflet, app shell)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // Only cache successful responses for same-origin or CDN assets
        if (resp.ok && (url.origin === self.location.origin || url.hostname.includes('cloudflare') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic'))) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// =====================================================================
//  Service worker: omogućuje "Dodaj na početni zaslon" i brže otvaranje.
//  Strategija: mreža prvo (uvijek svježi kod), a ako nema mreže, zadnja
//  spremljena verzija. Zahtjevi prema Supabaseu se NE diraju (podaci i
//  fotke uvijek idu direktno na mrežu).
//  Kad mijenjaš datoteke, povećaj VERSION da se stara spremljena verzija makne.
// =====================================================================
const VERSION = 'kavica-v5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll([
        './',
        'index.html',
        'css/style.css',
        'js/app.js',
        'js/config.js',
        'js/db.js',
        'js/db-demo.js',
        'js/score.js',
        'js/ui.js',
        'js/calendar.js',
        'js/location.js',
        'manifest.webmanifest',
        'icons/cat-cream.png',
        'icons/cat-cream-small.png',
        'icons/cat-brown.png',
      ]).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, fontovi, CDN -> preglednik sam

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});

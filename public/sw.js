// HEADS Rescate Dorado · service worker (v75).
// It exists ONLY so that Chrome / Edge / Samsung Internet on Android offer "install app" (they ask for a registered service worker with a fetch handler).
// It NEVER caches anything and changes nothing about how the game loads:
//   · install: skipWaiting · activate: clients.claim (a new version takes over at once, nothing old stays behind);
//   · fetch: it answers ONLY top-level page navigations, with a plain network fetch (what the browser would do anyway);
//     every other request (models, sounds, music and video range requests, /api/ ranking calls, fonts, scripts) is not touched: no respondWith, so the browser handles it itself.
// It is registered only on touch devices (src/game/35-instalar.js); PC never registers it. Netlify serves it with Cache-Control: no-cache (netlify.toml).
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request));
});

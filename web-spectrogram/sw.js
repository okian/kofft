const CACHE = 'spectrogram-cache-v1';
self.addEventListener('install', event => {
  console.log('SW install');
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/',
      '/index.html',
      '/app.mjs',
      '/manifest.json'
    ]))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

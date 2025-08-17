self.addEventListener('install', (e) => {
  console.log('Service worker installed');
  e.waitUntil(
    caches.open('spectrogram-cache').then((cache) =>
      cache.addAll([
        './',
        './index.html',
        './main.mjs',
        './pkg/web_spectrogram.js',
        './pkg/web_spectrogram_bg.wasm'
      ])
    )
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => resp || fetch(e.request))
  );
});

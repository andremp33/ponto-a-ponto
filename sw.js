/* Ponto a Ponto — service worker
   index.html: network-first (para apanhar versões novas); resto: cache-first.
   Incrementar CACHE_VERSION a cada release. */
const CACHE_VERSION = 'pap-v3';
const FONT_CACHE = 'pap-fonts';
const LIB_CACHE = 'pap-lib'; // motor do modelo local (WebLLM), para funcionar offline

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/apple-touch-icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/styles.css',
  './src/main.js',
  './src/core.js',
  './src/ui.js',
  './src/ai.js',
  './src/content.js',
  './src/science.js',
  './src/rules.js',
  './src/local-llm.js',
  './src/views/onboarding.js',
  './src/views/home.js',
  './src/views/train.js',
  './src/views/player.js',
  './src/views/neuro.js',
  './src/views/match.js',
  './src/views/coach.js',
  './src/views/me.js',
  './src/views/goals.js',
  './src/views/tournaments.js',
  './src/views/progress.js',
  './src/views/settings.js',
  './src/views/adjust.js',
  './src/views/science.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Só apaga caches antigas da app; as do modelo local (webllm/*) ficam.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pap-') && ![CACHE_VERSION, FONT_CACHE, LIB_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // A API da Anthropic nunca passa pela cache.
  if (url.hostname === 'api.anthropic.com') return;

  // Google Fonts e motor do modelo local: cache-first numa cache própria que sobrevive às versões.
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isLib = url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/');
  if (isFont || isLib) {
    event.respondWith(
      caches.open(isFont ? FONT_CACHE : LIB_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegação / index.html: network-first com fallback para a cache.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto do shell: cache-first.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});

const CACHE_VERSION = 'llegadas-madrid-v10';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const API_HOSTS = ['radardetrenes.com', 'llegadas-madrid-proxy.kdtekh.workers.dev'];

self.addEventListener('install', (event) => {
  // Request con {cache:'reload'} en vez de URLs planas: GitHub Pages sirve
  // index.html con Cache-Control: max-age=600, y cache.addAll(URLs) respeta
  // esa caché HTTP del navegador — al instalar una versión nueva del shell,
  // podía quedarse con una copia de index.html ya desactualizada.
  // cache.addAll sigue siendo todo-o-nada: si algún asset responde con un
  // error, la instalación entera falla y se mantiene el service worker
  // anterior en vez de cachear una respuesta rota como si fuera válida.
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(
        SHELL_ASSETS.map((url) => new Request(url, { cache: 'reload' }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('llegadas-madrid-') && key !== SHELL_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isApi = API_HOSTS.includes(url.hostname);

  if (isApi) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

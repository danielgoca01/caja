/* Caja Casa: guarda únicamente la interfaz; nunca intercepta la API de movimientos. */
const SHELL_CACHE = 'caja-casa-shell-3.0-20260919';
const SHELL_FILES = ['./', './sync.js', './ui.js', './ui.css', './manifest.json'];
const shellURLs = SHELL_FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(shellURLs)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('caja-casa-shell-') && key !== SHELL_CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;
  const canonical = new URL(url.pathname, url.origin).href;
  const isHome = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
  const key = isHome ? shellURLs[0] : canonical;
  if (!shellURLs.includes(key)) return;
  event.respondWith(caches.open(SHELL_CACHE).then(cache => cache.match(key))
    .then(cached => cached || fetch(event.request)));
});

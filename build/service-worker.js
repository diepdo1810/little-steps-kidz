// Vite replaces the two manifest tokens with the exact release's hash and local URLs.
const cachePrefix = 'little-steps-web-'
const cacheName = cachePrefix + __CACHE_VERSION__
const urls = __LOCAL_URLS__
const localPaths = new Set(urls)

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    await cache.addAll(urls.map(path => new Request(path, { cache: 'reload' })))
  })())
  // The new version waits for previous clients to close before retiring their assets.
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  const path = request.mode === 'navigate' ? '/index.html' : url.pathname
  if (!localPaths.has(path)) return
  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    return (await cache.match(path)) || fetch(request)
  })())
})

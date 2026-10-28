// Service worker: serves the app from the browser cache when the network is missing or slow.
// src/offline.ts fills the "lid-offline" cache with the whole app; anything else fetched
// while online is kept in "lid-runtime" so pages already seen also open offline.
const RUNTIME = 'lid-runtime'
// a page load waits this long for the network before falling back to the saved copy
const NAV_TIMEOUT = 4000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // other sites (stats), and the app's own downloads that must bypass the cache
  if (req.method !== 'GET' || url.origin !== location.origin || req.cache === 'reload' || req.cache === 'no-store') return
  e.respondWith(req.mode === 'navigate' ? page(req) : cacheFirst(req))
})

const indexUrl = () => new URL('index.html', self.registration.scope).href

/** network first so a new version shows up, the saved copy when offline or too slow */
async function page(req) {
  const net = fetch(req).then(async (res) => {
    if (res.ok) await (await caches.open(RUNTIME)).put(indexUrl(), res.clone())
    return res
  })
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT))
  const res = await Promise.race([net.catch(() => undefined), timeout])
  if (res) return res
  const saved = await caches.match(indexUrl())
  return saved ?? net
}

/** build files have the content hash in their name and images rarely change, so the cache wins */
async function cacheFirst(req) {
  const saved = await caches.match(req, { ignoreSearch: true })
  if (saved) return saved
  const res = await fetch(req)
  if (res.ok) {
    const copy = res.clone()
    caches.open(RUNTIME).then((c) => c.put(req, copy))
  }
  return res
}

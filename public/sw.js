// Service worker: caches ONLY static, non-personal assets (built JS/CSS, fonts, icons).
// Pages, API calls and Supabase requests always go to the network, so student records and
// financial data are never stored by the service worker. Writes need a connection.
const CACHE = "bls-static-v1";
const STATIC = /^\/(_next\/static\/|icons\/|.*\.(?:woff2?|png|svg|ico)$)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !STATIC.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) c.put(e.request, res.clone());
    return res;
  }));
});

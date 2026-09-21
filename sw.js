const CACHE = "stand-v12";
const ASSETS = ["./", "styles.css", "app.js", "content.js", "prayers.js", "compose.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache first for instant loads, refresh the cache in the background.
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  // Audio streams use range requests, which the Cache API can't store — let
  // the browser handle them directly.
  if (url.pathname.startsWith("/audio/")) return;
  const isAppNavigation = request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html");
  // Only the app shell is served from cache on navigation; static pages
  // (like the crawlable day/ pages) must reach the network untouched.
  if (request.mode === "navigate" && !isAppNavigation) return;
  const cacheKey = isAppNavigation ? "./" : request;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(cacheKey);
      const network = fetch(request)
        .then(response => {
          if (response.ok) cache.put(cacheKey, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

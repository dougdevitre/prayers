const CACHE = "stand-v39";
// The app shell is /app, not "./" — the root is the landing page now, and
// precaching it here would have served the app shell to anyone opening the
// site. Paths are absolute so they do not depend on where sw.js is fetched.
const APP_SHELL = "/app";
const ASSETS = [APP_SHELL, "/styles.css", "/report.js", "/app.js", "/ui.js", "/content.js", "/content.es.js", "/prayers.js", "/compose.js", "/logic.js", "/reminder.js", "/share.js", "/narration.js", "/audio-manifest.js", "/offline-audio.js", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

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
  // Recordings come from the audio CDN, another origin, so the check above
  // already leaves them to the browser. Anything under /audio/ (test fixtures,
  // a local recording) uses range requests the Cache API can't store.
  if (url.pathname.startsWith("/audio/")) return;
  // The calendar feed is a function of its query and must never be served
  // from this cache.
  if (url.pathname === "/calendar.ics" || url.pathname.startsWith("/api/")) return;
  // Share cards carry a year-long HTTP cache under hashed addresses, and the
  // app's ".latest." address must reach the network to learn the current
  // one; offline, the app draws its own card instead.
  if (url.pathname.startsWith("/cards/")) return;
  const isAppNavigation = request.mode === "navigate" && (url.pathname === APP_SHELL || url.pathname === "/app/index.html");
  // Only the app shell is served from cache on navigation; static pages
  // (the landing page at /, the fear index, the crawlable day/ pages) must
  // reach the network untouched.
  if (request.mode === "navigate" && !isAppNavigation) return;
  const cacheKey = isAppNavigation ? APP_SHELL : request;
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

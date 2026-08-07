const CACHE = "adnetx-v1";
const SHELL = ["/", "/index.html", "/css/style.css", "/js/main.js", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

// Network-first for HTML (so logged-in areas stay fresh), cache-first for static assets.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isHTML = e.request.headers.get("accept")?.includes("text/html");
  if (isHTML) {
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});

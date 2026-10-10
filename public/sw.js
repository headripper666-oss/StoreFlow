// Service worker StoreFlow — garde l'app (HTML, JS, polices) en cache pour qu'elle
// s'ouvre instantanément, même sans réseau. Les données ne sont PAS mises en cache ici.
const CACHE = "storeflow-v1";
const SCOPE = new URL(self.registration.scope);

// À l'installation : met en cache la page et les fichiers JS/CSS qu'elle référence
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(SCOPE.href, { cache: "no-store" });
      const html = await res.clone().text();
      await cache.put(SCOPE.href, res);
      const assets = [...html.matchAll(/assets\/[^"']+/g)].map((m) => new URL(m[0], SCOPE).href);
      await cache.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page : réponse immédiate depuis le cache, mise à jour en arrière-plan
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(SCOPE.href);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(SCOPE.href, res.clone());
            return res;
          })
          .catch(() => cached);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return network;
      })(),
    );
    return;
  }

  // Fichiers versionnés (JS/CSS) et polices : cache d'abord
  const isAsset = url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname + "assets/");
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (isAsset || isFont) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      }),
    );
  }
});

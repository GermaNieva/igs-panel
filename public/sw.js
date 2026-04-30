// IGS Panel — Service Worker mínimo, sin dependencias.
// Estrategias:
//  - Assets de Next.js (`/_next/static/...`): cache-first (inmutables).
//  - Imágenes y SVG: cache-first.
//  - HTML / RSC del panel y carta: stale-while-revalidate (rápido + se actualiza).
//  - Mutaciones (POST/PUT/DELETE) y server actions: SIEMPRE network — nunca cache.
//  - Webhook MP, callbacks de auth: bypass total.
//
// Bump CACHE_VERSION para invalidar todo el cache del SW al deployar cambios
// que necesiten cache fresh (ej. cuando cambia el shape del HTML del shell).

const CACHE_VERSION = "igs-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

// Rutas que NUNCA pasan por cache (ni se interceptan).
const BYPASS_PATHS = [
  "/api/mp-webhook",
  "/auth/",
  "/_next/data/", // reservado por si Next pone payloads de RSC ahí
];

// Toma control inmediato al instalarse.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar caches viejos.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo nuestro origen y solo GET.
  if (url.origin !== self.location.origin) return;
  if (req.method !== "GET") return;

  // Bypass paths críticos.
  if (BYPASS_PATHS.some((p) => url.pathname.startsWith(p))) return;

  // Server actions y RSC (Next pasa Accept: text/x-component) → siempre red,
  // sin cache. Los datos de SSR son request-specific, no compartibles.
  if (req.headers.get("accept")?.includes("text/x-component")) return;

  // Static assets de Next: cache-first, inmutables (versionados con hash).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Iconos / imágenes públicas: cache-first.
  if (
    url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/i)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // HTML / páginas: stale-while-revalidate (rápido + se refresca al fondo).
  if (
    req.destination === "document" ||
    req.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(staleWhileRevalidate(req, PAGES_CACHE));
    return;
  }

  // Para todo lo demás: network-first (no metemos cosas raras al cache).
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    // Sin red y sin cache → propagamos el error.
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((res) => {
      // Solo cachear respuestas exitosas y completas.
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  // Devolver cached al toque si existe; si no, esperar la red.
  if (cached) {
    // Trigger refresh atrás sin bloquear el response.
    networkPromise;
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  // Sin cache ni red.
  throw new Error("offline");
}

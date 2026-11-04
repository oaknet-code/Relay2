// Relay service worker: makes Relay installable on phones and keeps it
// usable on a patchy connection.
//
//   - Pages: always from the network, so every deploy shows up straight
//     away. With no connection, a small "you're offline" page.
//   - /assets/*: build files have a content hash in their name and never
//     change, so they're kept once fetched. A tab still running an older
//     build can then keep loading its pages after a deploy.
//   - /api/* and anything that isn't a GET: never touched (always live,
//     never stored — it carries people's data and session).

const SHELL_CACHE = "relay-shell-v1";
const ASSET_CACHE = "relay-assets-v1";
const MAX_ASSETS = 250;
const SHELL_FILES = ["/offline.html", "/icons/icon-192.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(request);
}

async function assetFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trimAssets();
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(assetFirst(request));
  }
});

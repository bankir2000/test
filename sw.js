"use strict";
const CACHE = "dokshtab-v13"; // bump on release so old caches are dropped
const LOCAL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    // A CDN hiccup must not block installation; the fetch handler caches them later.
    await Promise.all(CDN.map((url) => cache.add(new Request(url, { mode: "no-cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function store(request, response) {
  if (response.ok || response.type === "opaque") (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

// Own files: network first, so updates arrive without reinstalling; cache when offline.
async function networkFirst(request) {
  try {
    return await store(request, await fetch(request));
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || caches.match("index.html");
  }
}

// CDN libraries are versioned and immutable: cache first.
async function cacheFirst(request) {
  return (await caches.match(request)) || store(request, await fetch(request));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const own = new URL(event.request.url).origin === self.location.origin;
  event.respondWith(own ? networkFirst(event.request) : cacheFirst(event.request));
});

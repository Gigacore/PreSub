/// <reference lib="webworker" />
/* eslint-disable no-undef */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;
// augment for Workbox manifest
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: (string | PrecacheEntry)[];
  }
}

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// Optionally, handle navigation requests with a network-first fallback.
// This helps keep the app usable offline after first load.
self.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(self.registration.scope);
        // Fallback to the index if offline
        const cached = (await cache.match('/')) || (await cache.match('/index.html'));
        return cached ?? new Response('', { status: 503, statusText: 'Offline' });
      })
    );
  }
});

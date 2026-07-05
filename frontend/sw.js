import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Injected at build time by vite-plugin-pwa (injectManifest strategy) with
// the list of hashed build assets — the actual "cache assets/fonts/icons"
// requirement.
precacheAndRoute(self.__WB_MANIFEST);

// This is a client-side-routed SPA: /list/5, /lists, /share-target etc.
// aren't real files, so they're not in the precache manifest above (which
// only lists actual build output). Without this, a fresh/reload navigation
// to one of those URLs while offline falls through to the network and
// fails outright. Serve the cached app shell for any navigation instead —
// react-router takes it from there once JS runs.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// API GETs: try the network first (freshest data when online), fall back to
// whatever was last cached when offline. This is a coarse safety net —
// the app's real offline data layer is IndexedDB (see src/db.js), which
// works independently of this cache and is what the UI actually reads from.
registerRoute(
  ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET",
  new NetworkFirst({ cacheName: "api-cache", networkTimeoutSeconds: 3 })
);

// Background Sync: wakes up any open tab to drain its own outbox (the
// real sync logic — auth cookies, conflict handling — lives in
// the main-thread sync engine, not duplicated here). If no tab is open,
// this is a no-op; true zero-tab background sync would require storing
// credentials in the service worker itself, which this app intentionally
// doesn't do.
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-outbox") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SYNC_OUTBOX" }));
      })
    );
  }
});

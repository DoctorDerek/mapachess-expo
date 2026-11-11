/// <reference lib="webworker" />
import {
  CacheFirst,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist"
import partitionOfflineAssets from "../lib/offline/partitionOfflineAssets"

declare const self: ServiceWorkerGlobalScope &
  SerwistGlobalConfig & { __SW_MANIFEST?: (PrecacheEntry | string)[] }
const artCache = "mapachess-selected-art"
const { core, art: artKeys } = partitionOfflineAssets(
  self.__SW_MANIFEST ?? [],
  self.location.origin,
)

const worker = new Serwist({
  precacheEntries: core,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    plugins: [
      {
        handlerWillRespond: async ({ request, response }) =>
          request.destination === "worker"
            ? new Response(response.body, {
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
              })
            : response,
      },
    ],
    navigateFallback: "/",
    navigateFallbackAllowlist: [/^\/(?:\?.*)?$/],
    urlManipulation: ({ url }) => {
      if (url.origin !== self.location.origin || !url.searchParams.has("dpl"))
        return []
      const canonical = new URL(url)
      canonical.searchParams.delete("dpl")
      return [canonical]
    },
  },
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        url.origin === self.location.origin &&
        artKeys.has(url.pathname) &&
        [...url.searchParams.keys()].every((key) => key === "dpl"),
      handler: new CacheFirst({
        cacheName: artCache,
        plugins: [
          {
            cacheKeyWillBeUsed: async ({ request }) =>
              artKeys.get(new URL(request.url).pathname) ?? request,
          },
        ],
      }),
    },
  ],
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
})
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(artCache)
      for (const key of await cache.keys()) {
        const path = new URL(key.url).pathname
        if (artKeys.get(path) !== key.url) await cache.delete(key)
      }
    })(),
  )
})
worker.addEventListeners()

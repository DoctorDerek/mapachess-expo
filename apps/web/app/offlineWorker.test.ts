import { afterEach, describe, expect, it, vi } from "vitest"
import partitionOfflineAssets from "../lib/offline/partitionOfflineAssets"

type WorkerConfiguration = {
  precacheEntries: unknown[]
  precacheOptions: {
    urlManipulation: (input: { url: URL }) => URL[]
    plugins: {
      handlerWillRespond: (input: {
        request: Pick<Request, "destination">
        response: Response
      }) => Promise<Response>
    }[]
  }
  runtimeCaching: {
    matcher: (input: { url: URL }) => boolean
    handler: {
      options: {
        plugins: {
          cacheKeyWillBeUsed: (input: {
            request: Request
          }) => Promise<string | Request>
        }[]
      }
    }
  }[]
  skipWaiting: boolean
  clientsClaim: boolean
}
const worker = vi.hoisted(() => ({
  configuration: null as WorkerConfiguration | null,
  listen: vi.fn(),
}))
vi.mock("serwist", () => ({
  Serwist: class {
    constructor(configuration: WorkerConfiguration) {
      worker.configuration = configuration
    }
    addEventListeners = worker.listen
  },
  CacheFirst: class {
    constructor(
      readonly options: WorkerConfiguration["runtimeCaching"][number]["handler"]["options"],
    ) {}
  },
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function setup() {
  const manifest = [
    { url: "/", revision: "app-1" },
    {
      url: "/generated/presentation-assets/coach/neutral.png",
      revision: "art-1",
    },
  ]
  const scope = Object.assign(new EventTarget(), {
    location: new URL("https://mapachess.test"),
    __SW_MANIFEST: manifest,
  })
  const art = partitionOfflineAssets(manifest, scope.location.origin).art
  const current = art.values().next().value
  if (current === undefined)
    throw new Error("The manifest must contain versioned art.")
  const stale = new Request(
    "https://mapachess.test/generated/presentation-assets/coach/old.png",
  )
  const retained = new Request(current)
  const remove = vi.fn<(request: Request) => Promise<boolean>>(async () => true)
  const open = vi.fn(async () => ({
    keys: async () => [stale, retained],
    delete: remove,
  }))
  vi.stubGlobal("self", scope)
  vi.stubGlobal("caches", { open })
  vi.resetModules()
  await import("./sw")
  const configuration = worker.configuration
  if (configuration === null)
    throw new Error("The offline worker must register its policy.")
  return { scope, configuration, art, stale, retained, remove, open }
}

describe("offline worker application policy at its platform boundary", () => {
  it("preserves worker bootstrap identity without changing its cached bytes, headers or status", async () => {
    const { configuration } = await setup()
    const plugin = configuration.precacheOptions.plugins[0]
    if (plugin === undefined)
      throw new Error("Cached workers need their original bootstrap URL.")
    const response = new Response("self.postMessage(location.hash)", {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/javascript", "x-build": "one" },
    })
    Object.defineProperty(response, "url", {
      value: "https://mapachess.test/_next/static/chunks/worker.js",
    })
    const served = await plugin.handlerWillRespond({
      request: { destination: "worker" },
      response,
    })
    expect(served.url).toBe("")
    expect(served.status).toBe(response.status)
    expect(served.statusText).toBe(response.statusText)
    expect([...served.headers]).toEqual([...response.headers])
    expect(await served.text()).toBe("self.postMessage(location.hash)")
  })

  it.each(["document", "script", "style", "image", "font"] as const)(
    "leaves the original cached %s response and URL unchanged",
    async (destination) => {
      const { configuration } = await setup()
      const plugin = configuration.precacheOptions.plugins[0]
      if (plugin === undefined)
        throw new Error("The precache response policy must exist.")
      const response = new Response("unchanged")
      expect(
        await plugin.handlerWillRespond({ request: { destination }, response }),
      ).toBe(response)
    },
  )

  it("normalizes only same-origin deployment queries and caches only declared art without arbitrary query keys", async () => {
    const { configuration } = await setup()
    expect(worker.listen).toHaveBeenCalledOnce()
    expect(configuration.skipWaiting).toBe(false)
    expect(configuration.clientsClaim).toBe(true)
    const canonical = configuration.precacheOptions.urlManipulation({
      url: new URL("https://mapachess.test/?dpl=build-2&theme=light"),
    })
    expect(canonical.map(String)).toEqual([
      "https://mapachess.test/?theme=light",
    ])
    expect(
      configuration.precacheOptions.urlManipulation({
        url: new URL("https://outside.test/?dpl=x"),
      }),
    ).toEqual([])
    expect(
      configuration.precacheOptions.urlManipulation({
        url: new URL("https://mapachess.test/"),
      }),
    ).toEqual([])
    const route = configuration.runtimeCaching[0]
    if (route === undefined)
      throw new Error("The selected-art route must exist.")
    const path = "/generated/presentation-assets/coach/neutral.png"
    expect(
      route.matcher({ url: new URL(`https://mapachess.test${path}?dpl=x`) }),
    ).toBe(true)
    expect(
      route.matcher({
        url: new URL(`https://mapachess.test${path}?untrusted=1`),
      }),
    ).toBe(false)
    expect(route.matcher({ url: new URL(`https://outside.test${path}`) })).toBe(
      false,
    )
    expect(
      route.matcher({ url: new URL("https://mapachess.test/unknown.png") }),
    ).toBe(false)
  })

  it("keys known art by its manifest revision, leaves unknown requests alone, and deletes only stale cached artwork on activation", async () => {
    const { scope, configuration, art, stale, retained, remove, open } =
      await setup()
    const key = configuration.runtimeCaching[0]?.handler.options.plugins[0]
    if (key === undefined)
      throw new Error("Versioned artwork needs its cache-key plugin.")
    const request = new Request(
      "https://mapachess.test/generated/presentation-assets/coach/neutral.png?dpl=x",
    )
    expect(await key.cacheKeyWillBeUsed({ request })).toBe(
      art.get(new URL(request.url).pathname),
    )
    const unknown = new Request("https://mapachess.test/unknown.png")
    expect(await key.cacheKeyWillBeUsed({ request: unknown })).toBe(unknown)
    let completed: Promise<unknown> | undefined
    scope.dispatchEvent(
      Object.assign(new Event("activate"), {
        waitUntil: (promise: Promise<unknown>) => {
          completed = promise
        },
      }),
    )
    await completed
    expect(open).toHaveBeenCalledWith("mapachess-selected-art")
    expect(remove.mock.calls.map(([request]) => request.url)).toEqual([
      stale.url,
    ])
    expect(remove.mock.calls[0]?.[0]).not.toBe(retained)
  })
})

import { createHash } from "node:crypto"
import { afterEach, expect, it, vi } from "vitest"
import { presentationAssetSource } from "@mapachess/match-presentation/presentation-assets"
import { CHARACTER_PACK_ROOT } from "@/assets/characterArtPaths"
import { readCharacterArtPack } from "@/lib/presentation/characterArtFormat"
import { ART_PACK_HEADER_BYTES } from "@/lib/presentation/readIndexedArtPack"

const hero = "profile/hero/fixture.png"
const animal = "battle/fixture.png"
function packet(index: unknown, bytes: readonly number[]): ArrayBuffer {
  const directory = new TextEncoder().encode(JSON.stringify(index))
  const result = new Uint8Array(
    ART_PACK_HEADER_BYTES + directory.length + bytes.length,
  )
  new DataView(result.buffer).setUint32(0, directory.length, true)
  result.set(directory, ART_PACK_HEADER_BYTES)
  result.set(bytes, ART_PACK_HEADER_BYTES + directory.length)
  return result.buffer
}
const bytes = packet([[[hero, animal], 3]], [1, 2, 3])
const digest = createHash("sha256").update(new Uint8Array(bytes)).digest()
const url = `${CHARACTER_PACK_ROOT}/${digest.toString("hex")}.pack`
const descriptor = JSON.stringify({
  url,
  count: 2,
  integrity: `sha256-${digest.toString("base64")}`,
  seed: [],
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

it("resolves two registered identities from the same encoded member", () => {
  const lookup = readCharacterArtPack(bytes, 2)
  expect(lookup(presentationAssetSource(hero))).toBe(
    "data:image/webp;base64,AQID",
  )
  expect(lookup(presentationAssetSource(animal))).toBe(
    lookup(presentationAssetSource(hero)),
  )
  expect(lookup("missing")).toBeUndefined()
})

it("rejects truncated, aliased twice, incomplete and overlong directories", () => {
  for (const invalid of [
    bytes.slice(0, 2),
    bytes.slice(0, 8),
    bytes.slice(0, -1),
    packet([[[hero, hero], 1]], [0]),
    packet([[[hero], 1]], [0]),
    packet([[[hero, animal], 1]], [0, 1]),
    packet([[["coach/private.png", animal], 1]], [0]),
  ])
    expect(() => readCharacterArtPack(invalid, 2)).toThrow()
})

it("shares acquisition, retries a failure, and reopens from verified storage with zero fetches", async () => {
  vi.stubEnv("MAPACHESS_CHARACTER_ART", descriptor)
  vi.stubGlobal("document", { visibilityState: "hidden" })
  vi.stubGlobal("window", new EventTarget())
  const stored = new Map<string, Response>()
  const cache = {
    match: async (key: string) => stored.get(key)?.clone(),
    put: async (key: string, response: Response) => {
      stored.set(key, response)
    },
    delete: async (key: string) => stored.delete(key),
  }
  vi.stubGlobal("caches", { open: async () => cache })
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(bytes))
  vi.stubGlobal("fetch", fetch)
  const art = await import("./characterArtPack")
  await expect(
    Promise.all([
      art.resolveArtSource(presentationAssetSource(hero)),
      art.prepareCharacterArtPack(),
    ]),
  ).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(art.hasCharacterArtPack()).toBe(false)
  stored.set(url, new Response(new Uint8Array([0, 0, 0, 0])))
  const notify = vi.fn()
  const unsubscribe = art.subscribeCharacterArt(notify)
  const resolved = await Promise.all(
    [hero, animal].map((path) =>
      art.resolveArtSource(presentationAssetSource(path)),
    ),
  )
  expect(resolved[0]).toBe(resolved[1])
  expect(notify).toHaveBeenCalledOnce()
  unsubscribe()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenLastCalledWith(
    url,
    expect.objectContaining({
      integrity: expect.stringMatching(/^sha256-/),
      cache: "reload",
    }),
  )
  vi.resetModules()
  const reopened = await import("./characterArtPack")
  await expect(
    reopened.resolveArtSource(presentationAssetSource(animal)),
  ).resolves.toBe(resolved[1])
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each(["during failure", "after failure"] as const)(
  "recovers interested portraits once when connectivity returns %s",
  async (timing) => {
    vi.stubEnv("MAPACHESS_CHARACTER_ART", descriptor)
    vi.stubGlobal("document", { visibilityState: "hidden" })
    const browser = new EventTarget()
    vi.stubGlobal("window", browser)
    const failing = Promise.withResolvers<Response>()
    const fetch = vi
      .fn()
      .mockReturnValueOnce(failing.promise)
      .mockResolvedValueOnce(new Response(bytes))
    vi.stubGlobal("fetch", fetch)
    const art = await import("./characterArtPack")
    const displayed = Promise.withResolvers<void>()
    const first = vi.fn()
    const stopFirst = art.subscribeCharacterArt(first)
    const stopSecond = art.subscribeCharacterArt(displayed.resolve)
    const initial = art.prepareCharacterArtPack()
    if (timing === "during failure") browser.dispatchEvent(new Event("online"))
    failing.resolve(new Response(null, { status: 503 }))
    await expect(initial).rejects.toThrow()
    if (timing === "after failure") browser.dispatchEvent(new Event("online"))
    await displayed.promise
    expect(art.preparedArtSource(presentationAssetSource(animal))).toBe(
      "data:image/webp;base64,AQID",
    )
    expect(first).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledTimes(2)
    stopFirst()
    stopSecond()
  },
)

it("abandons a queued reconnect when the last interested portrait leaves", async () => {
  vi.stubEnv("MAPACHESS_CHARACTER_ART", descriptor)
  vi.stubGlobal("document", { visibilityState: "hidden" })
  const browser = new EventTarget()
  vi.stubGlobal("window", browser)
  const failing = Promise.withResolvers<Response>()
  const fetch = vi.fn().mockReturnValue(failing.promise)
  vi.stubGlobal("fetch", fetch)
  const art = await import("./characterArtPack")
  const notify = vi.fn()
  const stop = art.subscribeCharacterArt(notify)
  const initial = art.prepareCharacterArtPack()
  browser.dispatchEvent(new Event("online"))
  stop()
  failing.resolve(new Response(null, { status: 503 }))
  await expect(initial).rejects.toThrow()
  browser.dispatchEvent(new Event("online"))
  expect(fetch).toHaveBeenCalledOnce()
  expect(notify).toHaveBeenCalledTimes(0)
})

it("serves verified art while persistence is pending and after a quota failure", async () => {
  vi.stubEnv("MAPACHESS_CHARACTER_ART", descriptor)
  vi.stubGlobal("document", { visibilityState: "hidden" })
  const writing = Promise.withResolvers<void>()
  const stored = Promise.withResolvers<void>()
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async () => undefined,
      put: () => {
        writing.resolve()
        return stored.promise
      },
    }),
  })
  const fetch = vi.fn().mockResolvedValue(new Response(bytes))
  vi.stubGlobal("fetch", fetch)
  const art = await import("./characterArtPack")
  const drawing = art.resolveArtSource(presentationAssetSource(hero))
  await writing.promise
  try {
    expect(art.hasCharacterArtPack()).toBe(true)
    await expect(drawing).resolves.toBe("data:image/webp;base64,AQID")
  } finally {
    stored.reject(new Error("Storage quota exhausted"))
  }
  await expect(
    art.resolveArtSource(presentationAssetSource(animal)),
  ).resolves.toBe("data:image/webp;base64,AQID")
  expect(fetch).toHaveBeenCalledOnce()
})

it("leaves public builds without a character download and passes other artwork through", async () => {
  vi.stubEnv("MAPACHESS_CHARACTER_ART", "")
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const art = await import("./characterArtPack")
  await art.prepareCharacterArtPack()
  await expect(
    art.resolveArtSource(presentationAssetSource(hero)),
  ).rejects.toThrow()
  await expect(art.resolveArtSource("/medal.png")).resolves.toBe("/medal.png")
  expect(fetch).not.toHaveBeenCalled()
})

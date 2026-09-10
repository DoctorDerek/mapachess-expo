import { describe, expect, it, vi } from "vitest"
import createPresentationImages, {
  loadPresentationImage,
  type PresentationImageLoader,
} from "./presentationImages"

describe("presentation image ownership", () => {
  it("makes the first clip usable while a later clip is still decoding", async () => {
    const first = Promise.withResolvers<boolean>()
    const later = Promise.withResolvers<boolean>()
    const load = vi.fn<PresentationImageLoader>((source) => ({
      ready: source === "idle" ? first.promise : later.promise,
      release: vi.fn(),
    }))
    const images = createPresentationImages(load)
    let sequenceReady = false
    const sequence = images.prepare(["idle", "strike"]).then((ready) => {
      sequenceReady = ready
    })
    const firstPose = images.prepare(["idle"])
    first.resolve(true)
    expect(await firstPose).toBe(true)
    expect(sequenceReady).toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
    later.resolve(false)
    await sequence
    expect(sequenceReady).toBe(false)
    expect(await images.prepare(["idle"])).toBe(true)
  })

  it("rejects an abandoned decode even when a new request uses the same source", async () => {
    const abandoned = Promise.withResolvers<boolean>()
    const replacement = Promise.withResolvers<boolean>()
    const release = vi.fn()
    const load = vi
      .fn<PresentationImageLoader>()
      .mockReturnValueOnce({ ready: abandoned.promise, release })
      .mockReturnValueOnce({ ready: replacement.promise, release: vi.fn() })
    const images = createPresentationImages(load)
    const oldRequest = images.prepare(["portrait"])
    images.retain([])
    const currentRequest = images.prepare(["portrait"])
    abandoned.resolve(true)
    expect(await oldRequest).toBe(false)
    expect(release).toHaveBeenCalledOnce()
    replacement.resolve(true)
    expect(await currentRequest).toBe(true)
    expect(await images.prepare(["portrait"])).toBe(true)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("cancels an owned pending browser image without clearing a decoded image", async () => {
    const decode = Promise.withResolvers<void>()
    const image = { src: "", naturalWidth: 64, decode: () => decode.promise }
    vi.stubGlobal(
      "Image",
      class {
        constructor() {
          return image
        }
      },
    )
    try {
      const prepared = loadPresentationImage("coach.png")
      expect(image.src).toBe("coach.png")
      decode.resolve()
      expect(await prepared.ready).toBe(true)
      prepared.release()
      expect(image.src).toBe("coach.png")

      const pendingDecode = Promise.withResolvers<void>()
      image.decode = () => pendingDecode.promise
      const pending = loadPresentationImage("next.png")
      pending.release()
      expect(image.src).toBe("")
      pendingDecode.reject(new Error("Image request cancelled"))
      expect(await pending.ready).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("shares one preparation per source and releases only displaced sources", async () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>()
    const load = vi.fn<PresentationImageLoader>((source) => {
      const release = vi.fn()
      releases.set(source, release)
      return { ready: Promise.resolve(true), release }
    })
    const images = createPresentationImages(load)
    await Promise.all([
      images.prepare(["idle", "strike", "strike"]),
      images.prepare(["strike"]),
    ])
    expect(load.mock.calls.map(([source]) => source)).toEqual([
      "idle",
      "strike",
    ])
    images.retain(["strike"])
    expect(releases.get("idle")).toHaveBeenCalledOnce()
    expect(releases.get("strike")).not.toHaveBeenCalled()
    images.retain([])
    expect(releases.get("strike")).toHaveBeenCalledOnce()
  })

  it("does not mark a compound sequence ready before every clip is decoded", async () => {
    const landing = Promise.withResolvers<boolean>()
    const images = createPresentationImages((source) => ({
      ready: source === "land" ? landing.promise : Promise.resolve(true),
      release: vi.fn(),
    }))
    let ready = false
    const preparation = images
      .prepare(["jump", "fall", "land"])
      .then((result) => {
        ready = result
      })
    await Promise.resolve()
    expect(ready).toBe(false)
    landing.resolve(true)
    await preparation
    expect(ready).toBe(true)
  })

  it("reports failed replacement decoding and allows a later request to retry", async () => {
    const release = vi.fn()
    const load = vi
      .fn<PresentationImageLoader>()
      .mockReturnValueOnce({ ready: Promise.resolve(false), release })
      .mockReturnValueOnce({ ready: Promise.resolve(true), release: vi.fn() })
    const images = createPresentationImages(load)
    expect(await images.prepare(["strike"])).toBe(false)
    expect(release).toHaveBeenCalledOnce()
    expect(await images.prepare(["strike"])).toBe(true)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("releases an abandoned pending request without discarding the retained pose", async () => {
    const pending = Promise.withResolvers<boolean>()
    const releasePending = vi.fn(() => pending.resolve(false))
    const releasePose = vi.fn()
    const images = createPresentationImages((source) =>
      source === "pose"
        ? { ready: Promise.resolve(true), release: releasePose }
        : { ready: pending.promise, release: releasePending },
    )
    expect(await images.prepare(["pose"])).toBe(true)
    const replacement = images.prepare(["next"])
    images.retain(["pose"])
    expect(await replacement).toBe(false)
    expect(releasePending).toHaveBeenCalledOnce()
    expect(releasePose).not.toHaveBeenCalled()
    expect(await images.prepare(["pose"])).toBe(true)
  })
})

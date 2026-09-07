import { describe, expect, it, vi } from "vitest"
import createBattleSpriteImages, {
  type BattleSpriteImageLoader,
} from "./battleSpriteImages"

describe("battle sprite image ownership", () => {
  it("shares one preparation per source and releases only displaced sources", async () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>()
    const load = vi.fn<BattleSpriteImageLoader>((source) => {
      const release = vi.fn()
      releases.set(source, release)
      return { ready: Promise.resolve(true), release }
    })
    const images = createBattleSpriteImages(load)
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
    const images = createBattleSpriteImages((source) => ({
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
      .fn<BattleSpriteImageLoader>()
      .mockReturnValueOnce({ ready: Promise.resolve(false), release })
      .mockReturnValueOnce({ ready: Promise.resolve(true), release: vi.fn() })
    const images = createBattleSpriteImages(load)
    expect(await images.prepare(["strike"])).toBe(false)
    expect(release).toHaveBeenCalledOnce()
    expect(await images.prepare(["strike"])).toBe(true)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("releases an abandoned pending request without discarding the retained pose", async () => {
    const pending = Promise.withResolvers<boolean>()
    const releasePending = vi.fn(() => pending.resolve(false))
    const releasePose = vi.fn()
    const images = createBattleSpriteImages((source) =>
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

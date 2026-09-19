import { describe, expect, it, vi } from "vitest"
import createBattleRecipePreparation from "./battleRecipePreparation"
import createPresentationImages, {
  type PresentationImageLoader,
} from "./presentationImages"

const REQUEST = {
  phaseIndex: 0,
  reactionSequence: 1,
  sources: ["approach", "strike", "recovery"],
} as const

describe("battle recipe preparation", () => {
  it("waits for required recovery before admitting the entire reaction", async () => {
    const recovery = Promise.withResolvers<boolean>()
    const load = vi.fn<PresentationImageLoader>((source) => ({
      ready: source === "recovery" ? recovery.promise : Promise.resolve(true),
      release: vi.fn(),
    }))
    const preparation = createBattleRecipePreparation(
      createPresentationImages(load),
    )
    const first = preparation.prepare(REQUEST)
    let settled = false
    void first.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(
      preparation.prepare({ ...REQUEST, sources: [...REQUEST.sources] }),
    ).toBe(first)
    recovery.resolve(true)
    expect(await first).toBe(true)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it("keeps a failed recipe failed across beats but retries a new reaction", async () => {
    const load = vi.fn<PresentationImageLoader>((source) => ({
      ready: Promise.resolve(source !== "recovery"),
      release: vi.fn(),
    }))
    const images = createPresentationImages(load)
    const preparation = createBattleRecipePreparation(images)
    expect(await preparation.prepare(REQUEST)).toBe(false)
    load.mockImplementation(() => ({
      ready: Promise.resolve(true),
      release: vi.fn(),
    }))
    expect(await preparation.prepare(REQUEST)).toBe(false)
    expect(load).toHaveBeenCalledTimes(3)
    expect(await preparation.prepare({ ...REQUEST, reactionSequence: 2 })).toBe(
      true,
    )
    expect(load).toHaveBeenCalledTimes(4)
  })

  it("prepares a changed phase or selected recipe without advancing gameplay", async () => {
    const prepare = vi.fn(async () => true)
    const preparation = createBattleRecipePreparation({
      prepare,
      retain: vi.fn(),
    })
    await preparation.prepare(REQUEST)
    await preparation.prepare({ ...REQUEST, phaseIndex: 1 })
    await preparation.prepare({ ...REQUEST, sources: ["hurt"] })
    await preparation.prepare({
      ...REQUEST,
      sources: ["run", "strike", "recovery"],
    })
    expect(prepare.mock.calls).toHaveLength(4)
  })

  it("releases abandoned sources while preserving the last usable pose", async () => {
    const pending = Promise.withResolvers<boolean>()
    const releasePose = vi.fn()
    const releasePending = vi.fn()
    const images = createPresentationImages((source) => ({
      ready: source === "pose" ? Promise.resolve(true) : pending.promise,
      release: source === "pose" ? releasePose : releasePending,
    }))
    await images.prepare(["pose"])
    const preparation = createBattleRecipePreparation(images)
    const abandoned = preparation.prepare(REQUEST)
    images.retain(["pose"])
    pending.resolve(true)
    expect(await abandoned).toBe(false)
    expect(releasePending).toHaveBeenCalledTimes(3)
    expect(releasePose).not.toHaveBeenCalled()
    expect(await images.prepare(["pose"])).toBe(true)
  })

  it("allows effect cleanup and re-entry to prepare the same identity again", async () => {
    const load = vi.fn<PresentationImageLoader>(() => ({
      ready: Promise.resolve(true),
      release: vi.fn(),
    }))
    const images = createPresentationImages(load)
    const preparation = createBattleRecipePreparation(images)
    expect(await preparation.prepare(REQUEST)).toBe(true)
    preparation.reset()
    images.retain([])
    expect(await preparation.prepare(REQUEST)).toBe(true)
    expect(load).toHaveBeenCalledTimes(6)
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import loadProfileCardFont, {
  PROFILE_CARD_FALLBACK_FONT,
} from "./profileCardTypography"

afterEach(() => vi.unstubAllGlobals())

function fontEnvironment(family: string, load = vi.fn().mockResolvedValue([])) {
  vi.stubGlobal("document", { documentElement: {}, fonts: { load } })
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: () => family,
  }))
  return load
}

describe("profile-card font readiness", () => {
  it("waits for both label and number weights before returning the registered family", async () => {
    const pending = Promise.withResolvers<FontFace[]>()
    const load = fontEnvironment(
      '"Bundled Nunito", Arial',
      vi.fn().mockReturnValue(pending.promise),
    )
    let ready = false
    const loading = loadProfileCardFont().then((family) => {
      ready = true
      return family
    })
    await Promise.resolve()
    expect(ready).toBe(false)
    expect(load.mock.calls).toEqual([
      ['700 33px "Bundled Nunito", Arial'],
      ['900 65px "Bundled Nunito", Arial'],
    ])
    pending.resolve([])
    await expect(loading).resolves.toBe('"Bundled Nunito", Arial')
  })

  it("keeps export usable after a font download failure", async () => {
    fontEnvironment(
      '"Bundled Nunito", Arial',
      vi.fn().mockRejectedValue(new Error("Font download unavailable")),
    )
    await expect(loadProfileCardFont()).resolves.toBe(
      PROFILE_CARD_FALLBACK_FONT,
    )
  })

  it("uses the readable fallback without a load when no family is registered", async () => {
    const load = fontEnvironment(" ")
    await expect(loadProfileCardFont()).resolves.toBe(
      PROFILE_CARD_FALLBACK_FONT,
    )
    expect(load).not.toHaveBeenCalled()
  })
})

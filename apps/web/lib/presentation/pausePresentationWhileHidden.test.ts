import { afterEach, describe, expect, it, vi } from "vitest"
import pausePresentationWhileHidden from "./pausePresentationWhileHidden"

class VisibilityFixture extends EventTarget {
  hidden = false

  changeVisibility(hidden: boolean): void {
    this.hidden = hidden
    this.dispatchEvent(new Event("visibilitychange"))
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("visible-time presentation playback", () => {
  it("pauses and resumes the same playback without resetting it", () => {
    const visibility = new VisibilityFixture()
    vi.stubGlobal("document", visibility)
    const playback = { pause: vi.fn(), play: vi.fn() }
    const stopFollowingVisibility = pausePresentationWhileHidden(playback)
    expect(playback.play).not.toHaveBeenCalled()
    visibility.changeVisibility(true)
    visibility.changeVisibility(false)
    visibility.changeVisibility(true)
    visibility.changeVisibility(false)
    expect(playback.pause).toHaveBeenCalledTimes(2)
    expect(playback.play).toHaveBeenCalledTimes(2)
    stopFollowingVisibility()
  })

  it("starts paused when created in an already hidden document", () => {
    const visibility = new VisibilityFixture()
    visibility.hidden = true
    vi.stubGlobal("document", visibility)
    const playback = { pause: vi.fn(), play: vi.fn() }
    const stopFollowingVisibility = pausePresentationWhileHidden(playback)
    expect(playback.pause).toHaveBeenCalledTimes(1)
    expect(playback.play).not.toHaveBeenCalled()
    visibility.changeVisibility(false)
    expect(playback.play).toHaveBeenCalledTimes(1)
    stopFollowingVisibility()
  })

  it("leaves completed or abandoned playback detached from later visibility", () => {
    const visibility = new VisibilityFixture()
    vi.stubGlobal("document", visibility)
    const abandoned = { pause: vi.fn(), play: vi.fn() }
    const current = { pause: vi.fn(), play: vi.fn() }
    const detachAbandoned = pausePresentationWhileHidden(abandoned)
    const detachCurrent = pausePresentationWhileHidden(current)
    detachAbandoned()
    visibility.changeVisibility(true)
    visibility.changeVisibility(false)
    expect(abandoned.pause).not.toHaveBeenCalled()
    expect(abandoned.play).not.toHaveBeenCalled()
    expect(current.pause).toHaveBeenCalledTimes(1)
    expect(current.play).toHaveBeenCalledTimes(1)
    detachCurrent()
    visibility.changeVisibility(true)
    expect(current.pause).toHaveBeenCalledTimes(1)
  })
})

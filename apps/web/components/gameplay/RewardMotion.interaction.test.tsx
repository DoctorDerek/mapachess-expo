// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { LEVEL_ACHIEVEMENTS } from "@mapachess/profile/global-xp"
import { installDomHarness } from "../../test/domHarness"
import {
  controlledAnimations,
  controlledImages,
} from "../../test/presentationHarness"
import FirstArrivalRaccoon from "../presentation/FirstArrivalRaccoon"
import LevelAchievementToasts from "./LevelAchievementToasts"
import MatchLevelProgress from "./MatchLevelProgress"
import MatchSaveConfirmation from "./MatchSaveConfirmation"

const playback = vi.hoisted(() => ({ create: vi.fn(), reduced: false }))
vi.hoisted(() => vi.stubEnv("MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS", "true"))
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  animate: (...args: unknown[]) => playback.create(...args),
  useReducedMotion: () => playback.reduced,
}))
afterAll(() => vi.unstubAllEnvs())
installDomHarness()
const copy = loadCatalog("en")

function motions() {
  const instances: {
    update: (value: number) => void
    finish: () => void
    reject: () => void
    pause: ReturnType<typeof vi.fn>
    play: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    duration: number
  }[] = []
  playback.create.mockImplementation(
    (
      _start: number,
      _end: number,
      options: {
        duration: number
        onUpdate?: (value: number) => void
        onComplete?: () => void
      },
    ) => {
      const result = Promise.withResolvers<void>()
      const entry = {
        duration: options.duration,
        update: (value: number) => options.onUpdate?.(value),
        pause: vi.fn(),
        play: vi.fn(),
        stop: vi.fn(),
        finish: () => {
          options.onComplete?.()
          result.resolve()
        },
        reject: () => result.reject(new Error("Playback interrupted")),
      }
      instances.push(entry)
      return Object.assign(result.promise, entry)
    },
  )
  return instances
}
beforeEach(() => {
  playback.reduced = false
  playback.create.mockReset()
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
})

describe("reward progress and transient feedback lifecycle", () => {
  it("follows per-Level progress, pauses while hidden, reaches the exact result, and cancels owned playback", async () => {
    const instances = motions()
    const view = render(<MatchLevelProgress beforeXp={0} afterXp={3} />)
    expect(screen.getByText(copy.gameplay.level(1))).toBeTruthy()
    act(() => instances[0]?.update(0.5))
    expect(screen.getByText(copy.gameplay.xpProgress(1, 2))).toBeTruthy()
    vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    fireEvent(document, new Event("visibilitychange"))
    expect(instances[0]?.pause).toHaveBeenCalledOnce()
    vi.spyOn(document, "hidden", "get").mockReturnValue(false)
    fireEvent(document, new Event("visibilitychange"))
    expect(instances[0]?.play).toHaveBeenCalledOnce()
    await act(async () => instances[0]?.finish())
    expect(screen.getByText(copy.gameplay.level(2))).toBeTruthy()
    act(() => instances[1]?.update(0.5))
    await act(async () => instances[1]?.finish())
    expect(screen.getByText(copy.gameplay.xpProgress(1, 2))).toBeTruthy()
    expect(
      instances.reduce((sum, instance) => sum + instance.duration, 0),
    ).toBeCloseTo(3.7)
    view.unmount()
    expect(instances.at(-1)?.stop).toHaveBeenCalledOnce()
  })

  it("recovers an interrupted animation to the true final XP rather than stranding the bar", async () => {
    const instances = motions()
    render(<MatchLevelProgress beforeXp={3} afterXp={0} />)
    await act(async () => instances[0]?.reject())
    expect(screen.getByText(copy.gameplay.level(1))).toBeTruthy()
    expect(instances[0]?.stop).toHaveBeenCalledOnce()
  })

  it("displays final XP directly with Reduced Motion and ignores late updates after unmount", async () => {
    const instances = motions()
    playback.reduced = true
    const reduced = render(<MatchLevelProgress beforeXp={0} afterXp={4} />)
    expect(screen.getByText(copy.gameplay.level(3))).toBeTruthy()
    expect(instances).toHaveLength(0)
    reduced.unmount()
    playback.reduced = false
    const moving = render(<MatchLevelProgress beforeXp={0} afterXp={4} />)
    moving.unmount()
    await act(async () => {
      instances[0]?.update(1)
      instances[0]?.finish()
    })
    expect(instances).toHaveLength(1)
  })

  it("dismisses local-save feedback only after visible playback completion and cleans up", () => {
    const instances = motions()
    const view = render(<MatchSaveConfirmation />)
    expect(screen.getByRole("status").textContent).toContain(
      copy.interface.matchSaveConfirmation.savedLocally,
    )
    expect(instances[0]?.duration).toBe(5)
    act(() => instances[0]?.finish())
    expect(screen.queryByRole("status")).toBeNull()
    view.unmount()
    expect(instances[0]?.stop).toHaveBeenCalledOnce()
  })

  it("sequences achievements only while visible and unpaused, then removes its timers", () => {
    vi.useFakeTimers()
    try {
      const first = LEVEL_ACHIEVEMENTS[0]
      const second = LEVEL_ACHIEVEMENTS[1]
      if (first === undefined || second === undefined)
        throw new Error("Two achievement definitions are required.")
      const ids = [first.id, second.id]
      const view = render(<LevelAchievementToasts ids={ids} paused />)
      expect(screen.queryByRole("status")).toBeNull()
      view.rerender(<LevelAchievementToasts ids={ids} paused={false} />)
      expect(screen.getByRole("status").textContent).toContain(
        copy.gameplay.levelAchievement(first.level),
      )
      act(() => vi.advanceTimersByTime(4_000))
      view.rerender(<LevelAchievementToasts ids={[...ids]} paused={false} />)
      act(() => vi.advanceTimersByTime(1_000))
      expect(screen.getByRole("status").textContent).toContain(
        copy.gameplay.levelAchievement(second.level),
      )
      vi.spyOn(document, "hidden", "get").mockReturnValue(true)
      fireEvent(document, new Event("visibilitychange"))
      expect(screen.queryByRole("status")).toBeNull()
      act(() => vi.advanceTimersByTime(10000))
      vi.spyOn(document, "hidden", "get").mockReturnValue(false)
      fireEvent(document, new Event("visibilitychange"))
      expect(screen.getByRole("status").textContent).toContain(
        copy.gameplay.levelAchievement(second.level),
      )
      act(() => vi.advanceTimersByTime(4_999))
      expect(screen.getByRole("status").textContent).toContain(
        copy.gameplay.levelAchievement(second.level),
      )
      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByRole("status")).toBeNull()
      view.rerender(<LevelAchievementToasts ids={[...ids]} paused />)
      view.rerender(<LevelAchievementToasts ids={[...ids]} paused={false} />)
      expect(screen.queryByRole("status")).toBeNull()
      view.unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it("starts the arrival raccoon only after image load and removes it on its own crossing completion", () => {
    const images = controlledImages()
    const animations = controlledAnimations()
    const view = render(<FirstArrivalRaccoon />)
    const image = images.requests[0]?.image
    if (image === undefined)
      throw new Error("The arrival image must be requested.")
    fireEvent.load(image)
    expect(animations.running).toHaveLength(1)
    const sprite = view.container.querySelector("span")
    if (sprite === null) throw new Error("The raccoon sprite must exist.")
    fireEvent(sprite, new Event("webkitAnimationEnd", { bubbles: true }))
    expect(view.container.children).toHaveLength(1)
    if (sprite.parentElement === null)
      throw new Error("The crossing container must exist.")
    fireEvent(
      sprite.parentElement,
      new Event("webkitAnimationEnd", { bubbles: true }),
    )
    expect(view.container.children).toHaveLength(0)
    expect(animations.running[0]?.cancel).toHaveBeenCalledOnce()
    view.unmount()
    expect(image.onload).toBeNull()
    expect(image.onerror).toBeNull()
  })

  it("omits a failed arrival sprite and ignores late image events after unmount", () => {
    const images = controlledImages()
    controlledAnimations()
    const view = render(<FirstArrivalRaccoon />)
    const image = images.requests[0]?.image
    if (image === undefined) throw new Error("The arrival image must exist.")
    fireEvent.error(image)
    expect(view.container.children).toHaveLength(0)
    view.unmount()
    fireEvent.load(image)
    expect(view.container.children).toHaveLength(0)
  })
})

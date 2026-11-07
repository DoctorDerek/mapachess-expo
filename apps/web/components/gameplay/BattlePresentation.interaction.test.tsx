// @vitest-environment jsdom
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import useDecodedCoachPortrait from "../../lib/presentation/useDecodedCoachPortrait"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import { installDomHarness } from "../../test/domHarness"
import {
  controlledAnimations,
  controlledImages,
} from "../../test/presentationHarness"
import BattleFighter, { type BattleFighterProps } from "./BattleFighter"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"
import PortraitViewport from "./PortraitViewport"

const preferences = vi.hoisted(() => ({ reduced: false }))
vi.hoisted(() => vi.stubEnv("MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS", "true"))
vi.mock("motion", async (original) => ({
  ...(await original<typeof import("motion")>()),
  animate: () =>
    Object.assign(Promise.resolve(), {
      pause: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
    }),
}))
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => preferences.reduced,
}))
afterAll(() => vi.unstubAllEnvs())
installDomHarness()
beforeEach(() => {
  preferences.reduced = false
})

function fighter(beat: MatchPresentationBeat = "strike"): BattleFighterProps {
  return {
    beat,
    displayName: "Raccoon",
    facing: "right",
    participant: "player",
    phaseIndex: 2,
    reactionSequence: 9,
    presentation: resolveWebOpponentPresentation("raccoon-stockfish", {
      family: "capture",
      role: "attacker",
    }),
    opposingPresentation: resolveWebOpponentPresentation("chicken-stockfish", {
      family: "capture",
      role: "victim",
    }),
    onAnimationCompleted: vi.fn(),
    pauseTransientOnBackground: true,
    shouldReportCompletion: true,
  }
}

describe("battle animation ownership and recovery", () => {
  it.each(["approach", "strike", "reaction", "recovery"] as const)(
    "finishes the %s beat with its exact reaction identity",
    async (beat) => {
      const images = controlledImages()
      const animations = controlledAnimations()
      const props = fighter(beat)
      const view = render(<BattleFighter {...props} />)
      await images.complete()
      for (
        let step = 0;
        step < 12 &&
        vi.mocked(props.onAnimationCompleted).mock.calls.length === 0;
        step++
      )
        await animations.finish()
      await waitFor(() =>
        expect(props.onAnimationCompleted).toHaveBeenCalledWith("player", 2, 9),
      )
      expect(props.onAnimationCompleted).toHaveBeenCalledOnce()
      expect(screen.getByRole("img")).toBeTruthy()
      view.unmount()
      expect(
        animations.running.every(
          (animation) => animation.cancel.mock.calls.length > 0,
        ),
      ).toBe(true)
    },
  )

  it("pauses a victim reaction in the background, resumes it, and completes only after the animation", async () => {
    const images = controlledImages()
    const animations = controlledAnimations()
    const props = fighter("reaction")
    const view = render(
      <BattleFighter
        {...props}
        presentation={props.opposingPresentation}
        participant="opponent"
      />,
    )
    await images.complete()
    expect(animations.running.length).toBeGreaterThan(0)
    animations.hide(true)
    expect(animations.running.at(-1)?.pause).toHaveBeenCalled()
    expect(props.onAnimationCompleted).not.toHaveBeenCalled()
    animations.hide(false)
    expect(animations.running.at(-1)?.play).toHaveBeenCalled()
    await animations.finish()
    expect(props.onAnimationCompleted).toHaveBeenCalledWith("opponent", 2, 9)
    view.unmount()
  })

  it("skips an obsolete transient beat on backgrounding but never reports it twice", async () => {
    const images = controlledImages()
    const animations = controlledAnimations()
    const props = fighter()
    const view = render(
      <BattleFighter {...props} pauseTransientOnBackground={false} />,
    )
    await images.complete()
    animations.hide(true)
    expect(props.onAnimationCompleted).toHaveBeenCalledOnce()
    await animations.finish()
    animations.hide(false)
    expect(props.onAnimationCompleted).toHaveBeenCalledOnce()
    view.unmount()
  })

  it("settles a beat started while hidden without waiting for decoded assets", async () => {
    controlledImages()
    const animations = controlledAnimations()
    animations.hide(true)
    const props = fighter()
    render(<BattleFighter {...props} pauseTransientOnBackground={false} />)
    await waitFor(() =>
      expect(props.onAnimationCompleted).toHaveBeenCalledOnce(),
    )
    expect(animations.running).toHaveLength(0)
  })

  it("shows the reduced-motion final pose without scheduling a sprite animation", async () => {
    preferences.reduced = true
    const images = controlledImages()
    const animations = controlledAnimations()
    const props = fighter()
    render(<BattleFighter {...props} />)
    await images.complete()
    expect(props.onAnimationCompleted).toHaveBeenCalledWith("player", 2, 9)
    expect(animations.running).toHaveLength(0)
  })

  it("uses readable fallback content after decode failure and does not strand the presentation", async () => {
    const images = controlledImages()
    controlledAnimations()
    const props = fighter()
    render(<BattleFighter {...props} />)
    await images.complete(false)
    expect(
      screen.getByText(/Raccoon.*unavailable|unavailable.*Raccoon/i),
    ).toBeTruthy()
    expect(props.onAnimationCompleted).toHaveBeenCalledOnce()
  })

  it("rejects stale decode completion after a replacement reaction or unmount", async () => {
    const images = controlledImages()
    const animations = controlledAnimations()
    const props = fighter()
    const view = render(<BattleFighter {...props} />)
    view.rerender(
      <BattleFighter {...props} phaseIndex={3} reactionSequence={10} />,
    )
    await images.complete()
    for (
      let step = 0;
      step < 12 &&
      vi.mocked(props.onAnimationCompleted).mock.calls.length === 0;
      step++
    )
      await animations.finish()
    expect(props.onAnimationCompleted).toHaveBeenCalledWith("player", 3, 10)
    expect(props.onAnimationCompleted).not.toHaveBeenCalledWith("player", 2, 9)
    view.unmount()
    const abandonedCompletion = vi.fn()
    const abandoned = render(
      <BattleFighter {...props} onAnimationCompleted={abandonedCompletion} />,
    )
    abandoned.unmount()
    await images.complete()
    expect(abandonedCompletion).not.toHaveBeenCalled()
  })

  it("does not emit semantic completion for an idle-only display owner", async () => {
    preferences.reduced = true
    const images = controlledImages()
    controlledAnimations()
    const props = fighter("conclusion")
    render(
      <BattleFighter
        {...props}
        presentation={resolveWebOpponentPresentation("chicken-stockfish")}
        shouldReportCompletion={false}
      />,
    )
    await images.complete()
    expect(props.onAnimationCompleted).not.toHaveBeenCalled()
  })
})

describe("selectable animal and coach portrait lifecycles", () => {
  it("runs an animal attention clip, returns to calm, pauses when hidden, and releases on deselection", async () => {
    const images = controlledImages()
    const animations = controlledAnimations()
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const view = render(
      <PortraitViewport>
        <ChallengeAnimalPortrait
          opponent={{ id: "chicken-stockfish" }}
          active
        />
      </PortraitViewport>,
    )
    await images.complete()
    view.rerender(
      <PortraitViewport>
        <ChallengeAnimalPortrait
          opponent={{ id: "chicken-stockfish" }}
          active
          attention
        />
      </PortraitViewport>,
    )
    await images.complete()
    await waitFor(() => expect(animations.running.length).toBeGreaterThan(1))
    expect(animations.running.length).toBeGreaterThan(0)
    animations.hide(true)
    expect(animations.running.at(-1)?.pause).toHaveBeenCalled()
    animations.hide(false)
    expect(animations.running.at(-1)?.play).toHaveBeenCalled()
    await animations.finish()
    expect(animations.running.length).toBeGreaterThan(1)
    view.rerender(
      <PortraitViewport>
        <ChallengeAnimalPortrait
          opponent={{ id: "chicken-stockfish" }}
          active={false}
        />
      </PortraitViewport>,
    )
    expect(animations.running.at(-1)?.cancel).toHaveBeenCalled()
    view.unmount()
  })

  it("retains a neutral readable animal label if its initial image fails", async () => {
    const images = controlledImages()
    controlledAnimations()
    render(
      <ChallengeAnimalPortrait opponent={{ id: "chicken-stockfish" }} active />,
    )
    await images.complete(false)
    expect(screen.getByText("Chicken Stockfish")).toBeTruthy()
  })

  it("retains the last decoded coach while a replacement loads, retries failures, and ignores abandoned requests", async () => {
    const images = controlledImages()
    const hook = renderHook(
      ({ label }: { label: "neutral" | "happy_high" | "sad_low" }) =>
        useDecodedCoachPortrait({ kind: "portrait", label }, "greyfox"),
      { initialProps: { label: "neutral" } },
    )
    await images.complete()
    expect(hook.result.current.label).toBe("neutral")
    expect(hook.result.current.source).toContain("greyfox")
    hook.rerender({ label: "happy_high" })
    expect(hook.result.current.label).toBe("neutral")
    await images.complete(false)
    expect(hook.result.current.unavailable).toBe(true)
    act(() => hook.result.current.retry())
    await images.complete()
    expect(hook.result.current.source).toContain("?retry=1")
    expect(hook.result.current.label).toBe("happy_high")
    hook.rerender({ label: "sad_low" })
    act(() => hook.result.current.onImageError())
    await images.complete()
    expect(hook.result.current.label).toBe("sad_low")
    hook.unmount()
  })
})

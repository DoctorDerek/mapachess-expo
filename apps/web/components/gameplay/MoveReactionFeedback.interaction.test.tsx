// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest"
import { createActor, SimulatedClock } from "xstate"
import { MOVE_CLASSIFICATION_POLICY_ID } from "@mapachess/evaluation/move-classification"
import moveReactionMachine, {
  MOVE_REACTION_DURATION_MS,
  type MoveReaction,
} from "@mapachess/evaluation/move-reaction-machine"
import loadCatalog from "@mapachess/localization/catalog"
import { installDomHarness } from "../../test/domHarness"
import MoveReactionFeedback from "./MoveReactionFeedback"

const playback = vi.hoisted(() => ({ animate: vi.fn() }))
vi.mock("motion/react", async (original) => {
  const { useRef } = await import("react")
  return {
    ...(await original<typeof import("motion/react")>()),
    useAnimate: function useControlledAnimate() {
      return [useRef<HTMLSpanElement>(null), playback.animate]
    },
  }
})

installDomHarness()
const copy = loadCatalog("en")
beforeEach(() => {
  playback.animate.mockReset().mockImplementation(() => ({ stop: vi.fn() }))
})

const white: MoveReaction = {
  id: "white/1",
  ply: 1,
  mover: "white",
  notation: "1. e4",
  classification: {
    grade: "brilliant",
    reason: null,
    policyId: MOVE_CLASSIFICATION_POLICY_ID,
  },
}
const black: MoveReaction = {
  ...white,
  id: "black/2",
  ply: 2,
  mover: "black",
  notation: "1... e5",
  classification: { ...white.classification, grade: "good" },
}
const label = (reaction: MoveReaction) =>
  copy.board.dismissReaction(
    reaction.mover,
    reaction.notation,
    copy.shared.moveGrades[reaction.classification.grade],
  )

describe("web move-feedback contract", () => {
  it.each(["white", "black"] as const)(
    "keeps the %s player first and preserves full notation with a bold grade",
    (playerColor) => {
      const actor = createActor(moveReactionMachine).start()
      onTestFinished(() => {
        actor.stop()
      })
      actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: white })
      actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: black })
      render(
        <MoveReactionFeedback
          actor={actor}
          playerColor={playerColor}
          placement="top"
        />,
      )
      const ordered = playerColor === "white" ? [white, black] : [black, white]
      expect(
        screen
          .getAllByRole("button")
          .map((card) => card.getAttribute("aria-label")),
      ).toEqual(ordered.map(label))
      for (const reaction of ordered) {
        const card = screen.getByRole("button", { name: label(reaction) })
        expect(card.textContent).toBe(
          `${reaction.notation} ${copy.shared.moveGrades[reaction.classification.grade]}`,
        )
        expect(card.querySelector("strong")?.textContent).toBe(
          copy.shared.moveGrades[reaction.classification.grade],
        )
      }
      expect(playback.animate).toHaveBeenCalledTimes(2)
      expect(playback.animate.mock.calls[0]?.[2]).toEqual({
        duration: MOVE_REACTION_DURATION_MS / 1_000,
        ease: "linear",
      })
    },
  )

  it("starts independent lifetimes on presentation and does not restart them on placement changes", () => {
    const clock = new SimulatedClock()
    const actor = createActor(moveReactionMachine, { clock }).start()
    onTestFinished(() => {
      actor.stop()
    })
    actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: white })
    clock.increment(10_000)
    const view = render(
      <MoveReactionFeedback
        actor={actor}
        playerColor="white"
        placement="top"
      />,
    )
    expect(screen.getByRole("button", { name: label(white) })).toBeTruthy()
    act(() => {
      clock.increment(1_000)
      actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: black })
    })
    view.rerender(
      <MoveReactionFeedback
        actor={actor}
        playerColor="white"
        placement="middle"
      />,
    )
    view.rerender(
      <MoveReactionFeedback
        actor={actor}
        playerColor="white"
        placement="bottom"
      />,
    )
    expect(playback.animate).toHaveBeenCalledTimes(2)
    act(() => clock.increment(4_000))
    expect(screen.queryByRole("button", { name: label(white) })).toBeNull()
    expect(screen.getByRole("button", { name: label(black) })).toBeTruthy()
    act(() => clock.increment(1_000))
    expect(screen.queryAllByRole("button")).toEqual([])
  })

  it("dismisses only its exact card without propagating activation or stealing focus", () => {
    const actor = createActor(moveReactionMachine).start()
    onTestFinished(() => {
      actor.stop()
    })
    actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: white })
    actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: black })
    const underlyingAction = vi.fn()
    const focus = document.activeElement
    const view = render(
      <div onClick={underlyingAction}>
        <MoveReactionFeedback
          actor={actor}
          playerColor="white"
          placement="top"
        />
      </div>,
    )
    expect(document.activeElement).toBe(focus)
    const old = actor
      .getSnapshot()
      .context.cards.find((card) => card.reaction.mover === "white")
    if (old === undefined) throw new Error("Expected the player's active card")
    fireEvent.click(screen.getByRole("button", { name: label(white) }))
    expect(underlyingAction).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: label(white) })).toBeNull()
    expect(screen.getByRole("button", { name: label(black) })).toBeTruthy()
    const next = { ...white, id: "white/3", ply: 3, notation: "2. Nf3" }
    act(() => {
      actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: next })
      actor.send({
        type: "MOVE_REACTION.DISMISSED",
        presentationId: old.presentationId,
      })
    })
    expect(screen.getByRole("button", { name: label(next) })).toBeTruthy()
    view.unmount()
    for (const animation of playback.animate.mock.results)
      expect(animation.value.stop).toHaveBeenCalledOnce()
  })

  it.each(["12. O-O", "12... Nbd7", "24. exd8=Q+", "24... Rxe1#"])(
    "retains complete accepted notation %s",
    (notation) => {
      const actor = createActor(moveReactionMachine).start()
      onTestFinished(() => {
        actor.stop()
      })
      const reaction = { ...white, notation }
      actor.send({ type: "MOVE_REACTION.RECEIVED", reaction })
      render(
        <MoveReactionFeedback
          actor={actor}
          playerColor="white"
          placement="top"
        />,
      )
      expect(
        screen.getByRole("button", { name: label(reaction) }).textContent,
      ).toBe(`${notation} ${copy.shared.moveGrades.brilliant}`)
    },
  )
})

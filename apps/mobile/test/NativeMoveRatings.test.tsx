import "./nativeUiEnvironment"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native"
import { AccessibilityInfo, View } from "react-native"
import * as motion from "react-native-reanimated"
import { createActor, SimulatedClock, type ActorRefFrom } from "xstate"
import { MOVE_CLASSIFICATION_POLICY_ID } from "@mapachess/evaluation/move-classification"
import createMoveReactionController from "@mapachess/evaluation/move-reaction-controller"
import moveReactionMachine, {
  MOVE_REACTION_DURATION_MS,
  type MoveReaction,
} from "@mapachess/evaluation/move-reaction-machine"
import loadCatalog from "@mapachess/localization/catalog"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "@mapachess/match/match-position"
import { createMatchTimeline } from "@mapachess/match/match-timeline"
import { MOVE_GRADES } from "@mapachess/match/move-feedback"
import createInitialPlayerData from "@mapachess/profile/player-data"
import NativeChessboard from "@/components/gameplay/NativeChessboard"
import NativeMoveRatings from "@/components/gameplay/NativeMoveRatings"

const copy = loadCatalog("en")
const actors: ActorRefFrom<typeof moveReactionMachine>[] = []
afterEach(() => {
  for (const actor of actors.splice(0)) actor.stop()
})
const white: MoveReaction = {
  id: "white/1",
  ply: 1,
  mover: "white",
  notation: "1. e4",
  classification: {
    grade: "genius",
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

function open() {
  const clock = new SimulatedClock()
  const actor = createActor(moveReactionMachine, { clock }).start()
  actors.push(actor)
  const controller = createMoveReactionController(
    createMatchTimeline(
      createInitialMatchPosition({
        variant: "standard",
        chess960PositionId: null,
      }),
    ),
    actor,
  )
  return {
    controller,
    actor,
    clock,
    receive: (reaction: MoveReaction) =>
      actor.send({ type: "MOVE_REACTION.RECEIVED", reaction }),
  }
}

async function layOut(reaction: MoveReaction) {
  await fireEvent(
    screen.getByRole("button", { name: label(reaction) }),
    "layout",
    {
      nativeEvent: { layout: { x: 0, y: 0, width: 150, height: 48 } },
    },
  )
}

describe("native move-rating presentation", () => {
  it("preserves the composed board while promotion waits, cancels, and accepts one choice", async () => {
    const parsed = reconstructMatchPosition(
      { variant: "standard", chess960PositionId: null },
      "7k/P7/8/8/8/8/8/7K w - - 0 1",
    )
    if (!parsed.ok) throw new Error("Expected a legal promotion position")
    const move = jest.fn()
    await render(
      <NativeChessboard
        position={parsed.position}
        orientation="white"
        legalMoves={listLegalMatchMoves(parsed.position)}
        disabled={false}
        appearance={createInitialPlayerData().settings.chessAppearance}
        hints={null}
        showMoveHints={false}
        lastMove={null}
        onMove={move}
        renderBoardHost={(board, promotion) => (
          <View>
            {board}
            {promotion}
          </View>
        )}
      />,
    )
    const board = screen.getByLabelText(copy.board.orientation("white"))
    const chooseDestination = () =>
      fireEvent.press(
        screen.getByRole("button", { name: /^a8, empty, legal destination/ }),
      )
    await fireEvent.press(
      screen.getByRole("button", { name: /^a7, White pawn/ }),
    )
    await chooseDestination()
    expect(move).not.toHaveBeenCalled()
    for (const role of ["queen", "rook", "bishop", "knight"] as const)
      expect(
        screen.getByRole("button", { name: copy.board.promote(role) }),
      ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.board.cancelMove }),
    )
    expect(screen.getByLabelText(copy.board.orientation("white"))).toBe(board)
    expect(move).not.toHaveBeenCalled()
    await chooseDestination()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.board.promote("queen") }),
    )
    expect(move).toHaveBeenCalledTimes(1)
    expect(move).toHaveBeenCalledWith("a7a8q")
    expect(screen.getByLabelText(copy.board.orientation("white"))).toBe(board)
  })

  it.each(["white", "black"] as const)(
    "keeps the %s player on the left without requesting focus",
    async (playerColor) => {
      const { controller, receive, actor, clock } = open()
      const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      receive(white)
      receive(black)
      await render(
        <NativeMoveRatings
          controller={controller}
          playerColor={playerColor}
          placement="top"
          active
          reducedMotion
        />,
      )
      const ordered = playerColor === "white" ? [white, black] : [black, white]
      expect(
        screen
          .getAllByRole("button")
          .map((card) => card.props.accessibilityLabel),
      ).toEqual(ordered.map(label))
      expect(focus).not.toHaveBeenCalled()
      for (const reaction of ordered) {
        const card = screen.getByRole("button", { name: label(reaction) })
        expect(card.props.className).toContain(
          reaction.mover === "white"
            ? "bg-mapachito-white"
            : "bg-mapachito-charcoal",
        )
        expect(
          within(card).getByText(
            `${reaction.notation} ${copy.shared.moveGrades[reaction.classification.grade]}`,
          ),
        ).toBeOnTheScreen()
        expect(
          within(card).getByText(
            copy.shared.moveGrades[reaction.classification.grade],
          ).props.className,
        ).toBe("font-native")
      }
      await act(() => clock.increment(10_000))
      expect(actor.getSnapshot().context.cards).toHaveLength(2)
      await layOut(white)
      await layOut(black)
      expect(
        actor
          .getSnapshot()
          .context.cards.every((card) =>
            card.actor.getSnapshot().matches("displaying"),
          ),
      ).toBe(true)
    },
  )

  it("acknowledges each laid-out card once and expires staggered cards independently", async () => {
    const { controller, receive, clock } = open()
    const timing = jest.spyOn(motion, "withTiming")
    receive(white)
    receive(black)
    const view = await render(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="top"
        active
        reducedMotion={false}
      />,
    )
    await layOut(white)
    await act(() => clock.increment(1_000))
    await layOut(black)
    await view.rerender(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="bottom"
        active
        reducedMotion={false}
      />,
    )
    await layOut(white)
    await layOut(black)
    expect(timing).toHaveBeenCalledTimes(2)
    expect(timing.mock.calls[0]?.[1]).toMatchObject({
      duration: MOVE_REACTION_DURATION_MS,
    })
    await act(() => clock.increment(4_000))
    expect(screen.queryByRole("button", { name: label(white) })).toBeNull()
    expect(screen.getByRole("button", { name: label(black) })).toBeOnTheScreen()
    await act(() => clock.increment(1_000))
    expect(screen.queryAllByRole("button")).toEqual([])
  })

  it("dismisses one exact identity, stops propagation, and ignores its later callback", async () => {
    const { controller, receive, actor } = open()
    const cancel = jest.spyOn(motion, "cancelAnimation")
    receive(white)
    receive(black)
    const view = await render(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="top"
        active
        reducedMotion={false}
      />,
    )
    await layOut(white)
    await layOut(black)
    const old = actor
      .getSnapshot()
      .context.cards.find((card) => card.reaction.mover === "white")
    if (old === undefined) throw new Error("Expected the player's active card")
    const stopPropagation = jest.fn()
    await fireEvent.press(screen.getByRole("button", { name: label(white) }), {
      stopPropagation,
    })
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: label(white) })).toBeNull()
    expect(screen.getByRole("button", { name: label(black) })).toBeOnTheScreen()
    expect(old.actor.getSnapshot().status).toBe("stopped")
    const next = { ...white, id: "white/3", ply: 3, notation: "2. Nf3" }
    await act(() => {
      receive(next)
      actor.send({
        type: "MOVE_REACTION.DISMISSED",
        presentationId: old.presentationId,
      })
    })
    expect(screen.getByRole("button", { name: label(next) })).toBeOnTheScreen()
    await view.unmount()
    expect(cancel).toHaveBeenCalledTimes(3)
  })

  it("retains the five-second lifetime under Reduced Motion without starting decorative playback", async () => {
    const { controller, receive, clock } = open()
    const timing = jest.spyOn(motion, "withTiming")
    receive(white)
    const view = await render(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="top"
        active
        reducedMotion
      />,
    )
    await layOut(white)
    expect(timing).not.toHaveBeenCalled()
    await act(() => clock.increment(4_000))
    await view.rerender(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="middle"
        active
        reducedMotion={false}
      />,
    )
    await layOut(white)
    expect(timing).not.toHaveBeenCalled()
    await act(() => clock.increment(1_000))
    expect(screen.queryAllByRole("button")).toEqual([])
  })

  it("cancels normal-motion drawing when Reduced Motion changes without restarting expiry", async () => {
    const { controller, receive, clock } = open()
    const timing = jest.spyOn(motion, "withTiming")
    const cancel = jest.spyOn(motion, "cancelAnimation")
    receive(white)
    const view = await render(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="top"
        active
        reducedMotion={false}
      />,
    )
    await layOut(white)
    await act(() => clock.increment(4_000))
    await view.rerender(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="top"
        active
        reducedMotion
      />,
    )
    expect(cancel).toHaveBeenCalledTimes(1)
    await view.rerender(
      <NativeMoveRatings
        controller={controller}
        playerColor="white"
        placement="top"
        active
        reducedMotion={false}
      />,
    )
    await layOut(white)
    expect(timing).toHaveBeenCalledTimes(1)
    await act(() => clock.increment(1_000))
    expect(screen.queryAllByRole("button")).toEqual([])
  })

  it.each(MOVE_GRADES)(
    "keeps complete notation and the full %s label",
    async (grade) => {
      const { controller, receive } = open()
      const reaction = {
        ...white,
        notation: "24. exd8=Q+",
        classification: { ...white.classification, grade },
      }
      receive(reaction)
      await render(
        <NativeMoveRatings
          controller={controller}
          playerColor="white"
          placement="top"
          active
          reducedMotion
        />,
      )
      expect(
        screen.getByRole("button", { name: label(reaction) }),
      ).toHaveTextContent(
        `${reaction.notation} ${copy.shared.moveGrades[grade]}`,
      )
    },
  )
})

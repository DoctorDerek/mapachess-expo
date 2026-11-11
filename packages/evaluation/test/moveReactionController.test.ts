import { expect, it } from "vitest"
import { createActor } from "xstate"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  redoMatchTimeline,
  undoMatchTimeline,
  type MatchTimeline,
} from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import { MOVE_CLASSIFICATION_POLICY_ID } from "../src/moveClassification.js"
import createMoveReactionController from "../src/moveReactionController.js"
import moveReactionMachine from "../src/moveReactionMachine.js"

function acceptMove(timeline: MatchTimeline, uci: string) {
  const parsed = parseMatchMoveId(uci)
  if (!parsed.ok) throw new Error("Expected a legal move ID")
  const move = applyMatchTimelineMove(timeline, parsed.moveId)
  if (!move.ok) throw new Error(`Expected legal move ${uci}`)
  const record: MoveFeedbackRecord = {
    ply: move.timeline.cursor,
    moveId: move.transition.move.id,
    mover: move.transition.before.turn,
    beforeFen: move.transition.before.fen,
    afterFen: move.transition.after.fen,
    before: { kind: "draw" },
    after: { kind: "draw" },
    grade: "good",
    reason: null,
    policyId: MOVE_CLASSIFICATION_POLICY_ID,
  }
  return { timeline: move.timeline, record }
}

it("presents delayed feedback for the accepted branch once and clears it on rewind", ({
  onTestFinished,
}) => {
  const initial = createMatchTimeline(
    createInitialMatchPosition({
      variant: "standard",
      chess960PositionId: null,
    }),
  )
  const first = acceptMove(initial, "e2e4")
  const second = acceptMove(first.timeline, "e7e5")
  const controller = createMoveReactionController(initial)
  onTestFinished(controller.close)
  const plies = () =>
    controller.actor
      .getSnapshot()
      .context.cards.map(({ reaction }) => reaction.ply)

  controller.update(first.timeline, [], false)
  controller.update(
    second.timeline,
    [
      { ...first.record, policyId: "obsolete-policy" },
      { ...second.record, afterFen: first.record.afterFen },
    ],
    false,
  )
  expect(plies()).toEqual([])
  controller.update(second.timeline, [second.record, first.record], false)
  expect(plies()).toEqual([2, 1])
  expect(
    controller.actor
      .getSnapshot()
      .context.cards.map(({ reaction }) => reaction.notation),
  ).toEqual(["1... e5", "1. e4"])
  controller.update(second.timeline, [second.record, first.record], false)
  expect(plies()).toEqual([2, 1])

  const rewound = undoMatchTimeline(second.timeline)
  if (!rewound.ok) throw new Error("Expected Undo to be available")
  controller.update(rewound.timeline, [first.record, second.record], false)
  expect(plies()).toEqual([])
  const redone = redoMatchTimeline(rewound.timeline)
  if (!redone.ok) throw new Error("Expected Redo to be available")
  controller.update(redone.timeline, [second.record], false)
  expect(plies()).toEqual([])

  controller.update(rewound.timeline, [], false)
  const alternate = acceptMove(rewound.timeline, "c7c5")
  controller.update(
    alternate.timeline,
    [second.record, alternate.record],
    false,
  )
  expect(plies()).toEqual([2])
  expect(
    controller.actor.getSnapshot().context.cards[0]?.reaction.notation,
  ).toBe("1... c5")
  controller.update(alternate.timeline, [alternate.record], true)
  expect(plies()).toEqual([])
})

it("does not stop an externally owned reaction actor or replay a paused move", ({
  onTestFinished,
}) => {
  const initial = createMatchTimeline(
    createInitialMatchPosition({
      variant: "standard",
      chess960PositionId: null,
    }),
  )
  const move = acceptMove(initial, "d2d4")
  const actor = createActor(moveReactionMachine).start()
  onTestFinished(() => {
    actor.stop()
  })
  const controller = createMoveReactionController(initial, actor)
  controller.update(move.timeline, [move.record], true)
  controller.update(move.timeline, [move.record], false)
  expect(actor.getSnapshot().context.cards).toEqual([])
  controller.close()
  expect(actor.getSnapshot().status).toBe("active")
})

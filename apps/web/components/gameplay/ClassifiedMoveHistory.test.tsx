import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  applyMatchMove,
  listLegalMatchMoves,
  type MatchMoveTransition,
} from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import ClassifiedMoveHistory from "./ClassifiedMoveHistory"

const transitions: MatchMoveTransition[] = []
let position = createInitialMatchPosition({
  variant: "standard",
  chess960PositionId: null,
})
for (const uci of ["d2d4", "g8f6", "g1f3"]) {
  const move = listLegalMatchMoves(position).find(
    (candidate) => candidate.uci === uci,
  )
  if (!move) throw new Error("Expected legal history fixture move")
  const result = applyMatchMove(position, move.id)
  if (!result.ok) throw new Error("Expected accepted history fixture move")
  transitions.push(result.transition)
  position = result.transition.after
}
const records: readonly MoveFeedbackRecord[] = transitions.map(
  (transition, index) => ({
    ply: index + 1,
    moveId: transition.move.id,
    mover: transition.before.turn,
    beforeFen: transition.before.fen,
    afterFen: transition.after.fen,
    before: { kind: "draw" },
    after: { kind: "draw" },
    grade: "good",
    reason: null,
    policyId: "fixture",
  }),
)

describe("classified move history", () => {
  it("retains every side's numbered SAN and full grade without extra copy", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassifiedMoveHistory, { transitions, records }),
    )
    for (const notation of ["1. d4", "1... Nf6", "2. Nf3"])
      expect(markup).toContain(notation)
    expect(markup.match(/Good ✓/g)).toHaveLength(3)
    for (const excluded of [
      "White •",
      "Black •",
      "Lost forced mate",
      "centipawn",
      "swing",
    ])
      expect(markup).not.toContain(excluded)
  })

  it("does not attach a stale grade from another accepted position", () => {
    const stale = records.map((record) => ({
      ...record,
      afterFen: transitions[0]!.before.fen,
    }))
    const markup = renderToStaticMarkup(
      createElement(ClassifiedMoveHistory, { transitions, records: stale }),
    )
    expect(markup).toContain("2. Nf3")
    expect(markup).not.toContain("Good ✓")
  })
})

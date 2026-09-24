import { describe, expect, it } from "vitest"
import {
  applyMatchMove,
  listLegalMatchMoves,
  type MatchMoveTransition,
} from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
} from "@mapachess/match/match-position"
import classifyAcceptedMove from "../src/classifiedMove.js"
import type { PositionEvaluationResult } from "../src/positionEvaluator.js"

const initial = createInitialMatchPosition({
  variant: "standard",
  chess960PositionId: null,
})
const move = (position: MatchPosition, uci: string): MatchMoveTransition => {
  const candidate = listLegalMatchMoves(position).find(
    (entry) => entry.uci === uci,
  )
  if (candidate === undefined) throw new Error(`Missing legal move ${uci}`)
  const applied = applyMatchMove(position, candidate.id)
  if (!applied.ok) throw new Error("Expected move to apply")
  return applied.transition
}
const evaluation = (
  position: MatchPosition,
  whiteCentipawns: number,
  bestMove: string | null = null,
): PositionEvaluationResult => ({
  positionFen: position.fen,
  requestId: `evaluation/${position.fen}`,
  evaluation: { kind: "centipawns", bound: "exact", whiteCentipawns },
  bestMove,
})

describe("accepted-move evaluation pairing", () => {
  it("retains exact evaluations, move identity and policy for inspection", () => {
    const transition = move(initial, "e2e4")
    const before = evaluation(initial, 20, "e2e4")
    const after = evaluation(transition.after, 30)
    expect(
      classifyAcceptedMove({
        matchId: "match",
        ply: 1,
        transition,
        before,
        after,
      }),
    ).toEqual({
      status: "classified",
      record: {
        matchId: "match",
        ply: 1,
        move: transition.move,
        mover: "white",
        before,
        after,
        classification: {
          grade: "best",
          reason: null,
          policyId: "mapachess-gdd-3.1",
        },
      },
    })
  })

  it("rejects a fast opponent reply as the player's after evaluation", () => {
    const player = move(initial, "e2e4")
    const opponent = move(player.after, "e7e5")
    expect(() =>
      classifyAcceptedMove({
        matchId: "match",
        ply: 1,
        transition: player,
        before: evaluation(initial, 0),
        after: evaluation(opponent.after, 300),
      }),
    ).toThrow("exact before/after positions")
  })

  it("rejects a previous move's evaluation as the current move's before", () => {
    const player = move(initial, "e2e4")
    const opponent = move(player.after, "e7e5")
    expect(() =>
      classifyAcceptedMove({
        matchId: "match",
        ply: 2,
        transition: opponent,
        before: evaluation(initial, 0),
        after: evaluation(opponent.after, 0),
      }),
    ).toThrow("exact before/after positions")
  })

  it("grades Black from Black's perspective without using the after recommendation", () => {
    const player = move(initial, "e2e4")
    const transition = move(player.after, "e7e5")
    expect(
      classifyAcceptedMove({
        matchId: "match",
        ply: 2,
        transition,
        before: evaluation(transition.before, 0, "e7e5"),
        after: evaluation(transition.after, -300, "g1f3"),
      }),
    ).toMatchObject({
      record: { mover: "black", classification: { grade: "brilliant" } },
    })
  })

  it("matches standard castling by engine UCI rather than internal move ID", () => {
    const parsed = reconstructMatchPosition(
      { variant: "standard", chess960PositionId: null },
      "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    )
    if (!parsed.ok) throw new Error("Expected legal castle fixture")
    const transition = move(parsed.position, "e1g1")
    expect(transition.move.id).not.toBe(transition.move.uci)
    expect(
      classifyAcceptedMove({
        matchId: "castle",
        ply: 1,
        transition,
        before: evaluation(transition.before, 0, "e1g1"),
        after: evaluation(transition.after, 0),
      }),
    ).toMatchObject({ record: { classification: { grade: "best" } } })
  })

  it("does not mistake an upper/lower engine bound for an exact score", () => {
    const transition = move(initial, "e2e4")
    expect(
      classifyAcceptedMove({
        matchId: "match",
        ply: 1,
        transition,
        before: evaluation(initial, 0),
        after: {
          ...evaluation(transition.after, 300),
          evaluation: {
            kind: "centipawns",
            bound: "lower",
            whiteCentipawns: 300,
          },
        },
      }),
    ).toEqual({ status: "unavailable", reason: "bounded-evaluation" })
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid ply %s",
    (ply) => {
      const transition = move(initial, "e2e4")
      expect(() =>
        classifyAcceptedMove({
          matchId: "match",
          ply,
          transition,
          before: evaluation(initial, 0),
          after: evaluation(transition.after, 0),
        }),
      ).toThrow("positive ply")
    },
  )
})

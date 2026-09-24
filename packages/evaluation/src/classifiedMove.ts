import type { MatchMoveTransition } from "@mapachess/match/match-move"
import classifyMove, { type MoveClassification } from "./moveClassification.js"
import type { PositionEvaluationResult } from "./positionEvaluator.js"

export type ClassifiedMove = Readonly<{
  matchId: string
  ply: number
  move: MatchMoveTransition["move"]
  mover: MatchMoveTransition["before"]["turn"]
  before: PositionEvaluationResult
  after: PositionEvaluationResult
  classification: MoveClassification
}>

export type ClassifyAcceptedMoveInput = Readonly<{
  matchId: string
  ply: number
  transition: MatchMoveTransition
  before: PositionEvaluationResult
  after: PositionEvaluationResult
}>

export type ClassifyAcceptedMoveResult =
  | Readonly<{ status: "classified"; record: ClassifiedMove }>
  | Readonly<{ status: "unavailable"; reason: "bounded-evaluation" }>

export default function classifyAcceptedMove({
  matchId,
  ply,
  transition,
  before,
  after,
}: ClassifyAcceptedMoveInput): ClassifyAcceptedMoveResult {
  if (
    before.positionFen !== transition.before.fen ||
    after.positionFen !== transition.after.fen
  ) {
    throw new Error(
      "Move classification requires its exact before/after positions.",
    )
  }
  if (!Number.isSafeInteger(ply) || ply < 1) {
    throw new Error("Move classification requires a positive ply number.")
  }

  const result = classifyMove({
    before: before.evaluation,
    after: after.evaluation,
    mover: transition.before.turn,
    engineRecommended: before.bestMove === transition.move.uci,
  })
  if (result.status !== "classified") {
    return { status: "unavailable", reason: result.reason }
  }
  return {
    status: "classified",
    record: Object.freeze({
      matchId,
      ply,
      move: transition.move,
      mover: transition.before.turn,
      before,
      after,
      classification: result.classification,
    }),
  }
}

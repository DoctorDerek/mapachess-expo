import type { MatchColor } from "@mapachess/match/match-position"
import type { PositionEvaluation } from "./positionEvaluation.js"

export const MOVE_CLASSIFICATION_POLICY_ID = "mapachess-gdd-3.1" as const

export const MOVE_CLASSIFICATION_THRESHOLDS = Object.freeze({
  brilliantGain: 20,
  geniusGain: 10,
  inaccuracyLoss: 5,
  mistakeLoss: 10,
  blunderLoss: 20,
})

export type MoveClassificationGrade =
  | "brilliant"
  | "genius"
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"

export type MoveClassification = Readonly<{
  grade: MoveClassificationGrade
  policyId: typeof MOVE_CLASSIFICATION_POLICY_ID
  reason: "Lost forced mate" | null
}>

export type MoveClassificationInput = Readonly<{
  before: PositionEvaluation
  after: PositionEvaluation
  mover: MatchColor
  engineRecommended: boolean
}>

export type MoveClassificationResult =
  | Readonly<{ status: "classified"; classification: MoveClassification }>
  | Readonly<{
      status: "unavailable"
      reason: "bounded-evaluation"
    }>

const OUTCOME_LOGISTIC_COEFFICIENT = 0.00368208

export const moverOutcomeEstimate = (
  evaluation: PositionEvaluation,
  mover: MatchColor,
): number => {
  if (evaluation.kind === "draw") return 50
  if (evaluation.kind === "mate") return evaluation.winner === mover ? 100 : 0
  const whiteEstimate =
    100 /
    (1 + Math.exp(-OUTCOME_LOGISTIC_COEFFICIENT * evaluation.whiteCentipawns))
  return mover === "white" ? whiteEstimate : 100 - whiteEstimate
}

export const classifyOutcomeChange = (
  change: number,
  engineRecommended: boolean,
): MoveClassificationGrade => {
  const thresholds = MOVE_CLASSIFICATION_THRESHOLDS
  if (change >= thresholds.brilliantGain) return "brilliant"
  if (change >= thresholds.geniusGain) return "genius"
  if (change <= -thresholds.blunderLoss) return "blunder"
  if (change <= -thresholds.mistakeLoss) return "mistake"
  if (change <= -thresholds.inaccuracyLoss) return "inaccuracy"
  return engineRecommended ? "best" : "good"
}

const classified = (
  grade: MoveClassificationGrade,
  reason: MoveClassification["reason"] = null,
): MoveClassificationResult => ({
  status: "classified",
  classification: { grade, reason, policyId: MOVE_CLASSIFICATION_POLICY_ID },
})

export default function classifyMove({
  before,
  after,
  mover,
  engineRecommended,
}: MoveClassificationInput): MoveClassificationResult {
  if (
    (before.kind !== "draw" && before.bound !== "exact") ||
    (after.kind !== "draw" && after.bound !== "exact")
  ) {
    return { status: "unavailable", reason: "bounded-evaluation" }
  }

  if (before.kind === "mate" && before.winner === mover) {
    if (after.kind === "mate" && after.winner === mover) {
      const extraMatingMoves = after.moves - (before.moves - 1)
      if (extraMatingMoves <= -2) return classified("brilliant")
      if (extraMatingMoves === -1) return classified("genius")
      if (extraMatingMoves === 0)
        return classified(engineRecommended ? "best" : "good")
      if (extraMatingMoves === 1) return classified("good")
      if (extraMatingMoves === 2) return classified("inaccuracy")
      return classified("mistake")
    }

    const loss = 100 - moverOutcomeEstimate(after, mover)
    return classified(
      loss >= MOVE_CLASSIFICATION_THRESHOLDS.blunderLoss
        ? "blunder"
        : loss >= MOVE_CLASSIFICATION_THRESHOLDS.mistakeLoss
          ? "mistake"
          : "inaccuracy",
      "Lost forced mate",
    )
  }

  return classified(
    classifyOutcomeChange(
      moverOutcomeEstimate(after, mover) - moverOutcomeEstimate(before, mover),
      engineRecommended,
    ),
  )
}

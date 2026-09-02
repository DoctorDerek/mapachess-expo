import type { MatchDrawOfferDecision } from "@mapachess/match/match-conclusion"
import type { MatchColor } from "@mapachess/match/match-position"
import type {
  PositionEvaluation,
  PositionEvaluationBound,
} from "./positionEvaluation.js"
import type { PositionEvaluationResult } from "./positionEvaluator.js"

export const PROVISIONAL_CHICKEN_DRAW_ACCEPTANCE_CENTIPAWNS = 100 as const

export type ChickenDrawDecisionInput = Readonly<{
  evaluationResult: PositionEvaluationResult | null
  playerColor: MatchColor
  positionFen: string
}>

const invertBound = (
  bound: PositionEvaluationBound,
): PositionEvaluationBound =>
  bound === "lower" ? "upper" : bound === "upper" ? "lower" : "exact"

const chickenCentipawnEvaluation = (
  evaluation: Extract<PositionEvaluation, { kind: "centipawns" }>,
  playerColor: MatchColor,
): Readonly<{
  bound: PositionEvaluationBound
  centipawns: number
}> =>
  playerColor === "black"
    ? Object.freeze({
        bound: evaluation.bound,
        centipawns: evaluation.whiteCentipawns,
      })
    : Object.freeze({
        bound: invertBound(evaluation.bound),
        centipawns: -evaluation.whiteCentipawns,
      })

const chickenAcceptsEvaluation = (
  evaluation: PositionEvaluation,
  playerColor: MatchColor,
): boolean => {
  if (evaluation.kind === "draw") return true
  if (evaluation.kind === "mate") {
    return evaluation.bound === "exact" && evaluation.winner === playerColor
  }

  const chickenEvaluation = chickenCentipawnEvaluation(evaluation, playerColor)
  return (
    (chickenEvaluation.bound === "exact" ||
      chickenEvaluation.bound === "upper") &&
    chickenEvaluation.centipawns <=
      PROVISIONAL_CHICKEN_DRAW_ACCEPTANCE_CENTIPAWNS
  )
}

export default function decideChickenDrawOffer(
  input: ChickenDrawDecisionInput,
): MatchDrawOfferDecision | null {
  if (
    input.evaluationResult === null ||
    input.evaluationResult.positionFen !== input.positionFen
  ) {
    return null
  }

  return Object.freeze({
    outcome: chickenAcceptsEvaluation(
      input.evaluationResult.evaluation,
      input.playerColor,
    )
      ? "accepted"
      : "rejected",
    positionFen: input.positionFen,
  })
}

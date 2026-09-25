import type { MatchColor, MatchPosition } from "@mapachess/match/match-position"
import type {
  PositionEvaluation,
  PositionEvaluationBound,
} from "@mapachess/match/move-feedback"
import type { StockfishScore } from "@mapachess/stockfish/engine-session"

export type {
  PositionEvaluation,
  PositionEvaluationBound,
} from "@mapachess/match/move-feedback"

export const positionEvaluationLabel = (
  evaluation: PositionEvaluation,
): string => {
  if (evaluation.kind === "draw") return "0.00"
  if (evaluation.kind === "mate") {
    const winner = evaluation.winner === "white" ? "White" : "Black"
    const label =
      evaluation.moves === 0
        ? `${winner} checkmate`
        : `${winner} M${String(evaluation.moves)}`
    return evaluation.bound === "exact"
      ? label
      : `${label} · ${evaluation.bound} bound`
  }
  const sign =
    evaluation.whiteCentipawns > 0
      ? "+"
      : evaluation.whiteCentipawns < 0
        ? "−"
        : ""
  const pawns = `${sign}${(Math.abs(evaluation.whiteCentipawns) / 100).toFixed(2)}`
  return evaluation.bound === "exact"
    ? pawns
    : `${evaluation.bound === "lower" ? "≥" : "≤"} ${pawns}`
}

const invertBound = (
  bound: PositionEvaluationBound,
): PositionEvaluationBound =>
  bound === "lower" ? "upper" : bound === "upper" ? "lower" : "exact"

export const terminalPositionEvaluation = (
  position: MatchPosition,
): PositionEvaluation | undefined => {
  if (
    position.status.type === "stalemate" ||
    position.status.type === "insufficient-material"
  ) {
    return Object.freeze({ kind: "draw" })
  }

  if (position.status.type === "checkmate") {
    return Object.freeze({
      bound: "exact",
      kind: "mate",
      moves: 0,
      winner: position.status.winner,
    })
  }

  return undefined
}

export const normalizeStockfishPositionEvaluation = (
  turn: MatchColor,
  score: StockfishScore,
): PositionEvaluation => {
  const fromWhitePerspective = turn === "white" ? score.value : -score.value
  const bound = turn === "white" ? score.bound : invertBound(score.bound)

  if (score.kind === "centipawns") {
    return Object.freeze({
      bound,
      kind: "centipawns",
      whiteCentipawns: fromWhitePerspective,
    })
  }

  if (score.value === 0) {
    throw new TypeError("A non-terminal Stockfish mate score cannot be zero.")
  }

  return Object.freeze({
    bound,
    kind: "mate",
    moves: Math.abs(score.value),
    winner: fromWhitePerspective > 0 ? "white" : "black",
  })
}

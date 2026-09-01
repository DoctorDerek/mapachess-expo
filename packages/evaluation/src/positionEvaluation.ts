import type { MatchColor, MatchPosition } from "@mapachess/match/match-position"
import type { StockfishScore } from "@mapachess/stockfish/engine-session"

export type PositionEvaluationBound = "exact" | "lower" | "upper"

export type PositionEvaluation =
  | Readonly<{ kind: "draw" }>
  | Readonly<{
      bound: PositionEvaluationBound
      kind: "centipawns"
      whiteCentipawns: number
    }>
  | Readonly<{
      bound: PositionEvaluationBound
      kind: "mate"
      moves: number
      winner: MatchColor
    }>

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

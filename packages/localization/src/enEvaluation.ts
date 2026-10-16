import { formatCentipawns } from "./enNumbers.js"
import type { EvaluationBound } from "./numberFormatters.js"

const colors = { white: "White", black: "Black" } as const

const evaluation = {
  even: "Even",
  unavailable: "Evaluation unavailable",
  waiting: "Waiting for evaluation",
  whiteRelative: (score: string): string =>
    `Evaluation from White’s perspective: ${score}`,
  draw: "0.00",
  mate: (
    winner: keyof typeof colors,
    moves: number,
    bound: EvaluationBound,
  ): string => {
    const score =
      moves === 0
        ? `${colors[winner]} checkmate`
        : `${colors[winner]} M${moves}`
    return bound === "exact" ? score : `${score} · ${bound} bound`
  },
  centipawns: formatCentipawns,
} as const

export default evaluation

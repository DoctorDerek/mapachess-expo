import type { MapachessCatalog } from "./catalog.js"
import { formatCentipawns } from "./esMxNumbers.js"
import type { EvaluationBound } from "./numberFormatters.js"

const colors = { white: "Blancas", black: "Negras" } as const

const evaluation = {
  even: "Igualada",
  unavailable: "Evaluación no disponible",
  waiting: "Esperando evaluación",
  whiteRelative: (score: string): string =>
    `Evaluación desde la perspectiva de las blancas: ${score}`,
  draw: "0.00",
  mate: (
    winner: keyof typeof colors,
    moves: number,
    bound: EvaluationBound,
  ): string => {
    const score =
      moves === 0
        ? `Las ${colors[winner].toLowerCase()} dan jaque mate`
        : `${colors[winner]} M${moves}`
    return bound === "exact"
      ? score
      : `${score} · límite ${bound === "lower" ? "inferior" : "superior"}`
  },
  centipawns: formatCentipawns,
} as const satisfies MapachessCatalog["evaluation"]

export default evaluation

let decimal: Intl.NumberFormat | undefined
const colors = { white: "White", black: "Black" } as const

const evaluation = {
  even: "Even",
  unavailable: "Evaluation unavailable",
  waiting: "Evaluation waiting",
  whiteRelative: (score: string): string =>
    `White-relative evaluation ${score}`,
  draw: "0.00",
  mate: (
    winner: keyof typeof colors,
    moves: number,
    bound: "exact" | "lower" | "upper",
  ): string => {
    const score =
      moves === 0
        ? `${colors[winner]} checkmate`
        : `${colors[winner]} M${moves}`
    return bound === "exact" ? score : `${score} · ${bound} bound`
  },
  centipawns: (value: number, bound: "exact" | "lower" | "upper"): string => {
    decimal ??= new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    })
    const sign = value > 0 ? "+" : value < 0 ? "−" : ""
    const score = `${sign}${decimal.format(Math.abs(value) / 100)}`
    return bound === "exact"
      ? score
      : `${bound === "lower" ? "≥" : "≤"} ${score}`
  },
} as const

export default evaluation

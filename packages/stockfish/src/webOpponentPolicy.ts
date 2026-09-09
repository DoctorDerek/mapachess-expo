import type { StockfishEngineConfiguration } from "./engineSession.js"

export const WEB_OPPONENT_NODE_LIMIT = 10_000 as const

export const WEB_OPPONENT_ENGINE_CONFIGURATION = Object.freeze({
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
}) satisfies Omit<StockfishEngineConfiguration, "variant">

export const PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS = Object.freeze({
  standard: Object.freeze([
    9_150, 8_200, 7_350, 6_550, 6_150, 5_800, 5_400, 5_050, 4_450, 3_850,
  ] as const),
  chess960: Object.freeze([
    9_300, 8_700, 8_100, 7_400, 6_650, 6_000, 5_350, 4_800, 4_300, 3_800,
  ] as const),
})

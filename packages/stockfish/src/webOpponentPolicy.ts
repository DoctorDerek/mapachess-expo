import type { StockfishEngineConfiguration } from "./engineSession.js"

export const WEB_OPPONENT_NODE_LIMIT = 10_000 as const

export const WEB_OPPONENT_ENGINE_CONFIGURATION = Object.freeze({
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
}) satisfies Omit<StockfishEngineConfiguration, "variant">

const WEB_LADDER_RANDOM_PRESETS = Object.freeze([
  { standard: 9_000, chess960: 8_350 },
  8_000,
  7_350,
  6_550,
  6_150,
  5_500,
  { standard: 5_000, chess960: 5_400 },
  { standard: 4_450, chess960: 5_000 },
  { standard: 3_850, chess960: 4_450 },
  3_650,
  3_200,
  2_800,
  2_550,
  2_325,
  2_000,
  1_725,
  1_350,
  1_125,
  825,
  550,
  400,
  250,
  80,
] as const)

export const WEB_LADDER_RANDOM_BASIS_POINTS = Object.freeze({
  standard: Object.freeze(
    WEB_LADDER_RANDOM_PRESETS.map((preset) =>
      typeof preset === "number" ? preset : preset.standard,
    ),
  ),
  chess960: Object.freeze(
    WEB_LADDER_RANDOM_PRESETS.map((preset) =>
      typeof preset === "number" ? preset : preset.chess960,
    ),
  ),
})

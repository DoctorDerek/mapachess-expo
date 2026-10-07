export const MATCH_VARIANTS = ["standard", "chess960"] as const

export type MatchVariant = (typeof MATCH_VARIANTS)[number]

export const MATCH_VARIANT_LABELS = {
  standard: "Standard Chess",
  chess960: "Chess960",
} as const satisfies Readonly<Record<MatchVariant, string>>

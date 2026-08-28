export const MATCH_VARIANTS = ["standard", "chess960"] as const

export type MatchVariant = (typeof MATCH_VARIANTS)[number]

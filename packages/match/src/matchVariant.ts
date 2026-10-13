import loadCatalog from "@mapachess/localization/catalog"

export const MATCH_VARIANTS = ["standard", "chess960"] as const

export type MatchVariant = (typeof MATCH_VARIANTS)[number]

export const MATCH_VARIANT_LABELS = loadCatalog("en").setup
  .variants satisfies Readonly<Record<MatchVariant, string>>

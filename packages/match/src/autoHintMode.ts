import loadCatalog from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"

export const AUTO_HINT_MODES = [
  "auto-move-hints",
  "auto-piece-hints",
  "no-auto-hints",
] as const

export type AutoHintMode = (typeof AUTO_HINT_MODES)[number]

export const HINT_ASSISTANCE_TIERS = ["bronze", "silver", "gold"] as const
export type HintAssistanceTier = (typeof HINT_ASSISTANCE_TIERS)[number]

export const DEFAULT_AUTO_HINT_MODE: AutoHintMode = "auto-move-hints"

export const AUTO_HINT_MODE_PRESENTATION = Object.freeze({
  "auto-move-hints": {
    ...loadCatalog("en").setup.autoHints["auto-move-hints"],
    medalTier: "bronze",
  },
  "auto-piece-hints": {
    ...loadCatalog("en").setup.autoHints["auto-piece-hints"],
    medalTier: "silver",
  },
  "no-auto-hints": {
    ...loadCatalog("en").setup.autoHints["no-auto-hints"],
    medalTier: "gold",
  },
} as const satisfies Readonly<
  Record<
    AutoHintMode,
    Readonly<{
      label: string
      description: string
      medal: string
      medalTier: HintAssistanceTier
    }>
  >
>)

export const AUTO_HINT_MEDAL_EXPLANATION =
  loadCatalog("en").setup.hintMedalExplanation

export const autoHintModeLabel = (
  autoHintMode: AutoHintMode,
  locale: ShippedLocale = "en",
): string => loadCatalog(locale).setup.autoHints[autoHintMode].label

export const autoHintModeFromLegacyEnabled = (
  autoHintsEnabled: boolean,
): AutoHintMode => (autoHintsEnabled ? DEFAULT_AUTO_HINT_MODE : "no-auto-hints")

export const isAutoHintMode = (received: unknown): received is AutoHintMode =>
  typeof received === "string" &&
  (AUTO_HINT_MODES as readonly string[]).includes(received)

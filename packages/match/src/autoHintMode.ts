export const AUTO_HINT_MODES = [
  "auto-move-hints",
  "auto-piece-hints",
  "no-auto-hints",
] as const

export type AutoHintMode = (typeof AUTO_HINT_MODES)[number]

export const DEFAULT_AUTO_HINT_MODE: AutoHintMode = "auto-move-hints"

export const autoHintModeFromLegacyEnabled = (
  autoHintsEnabled: boolean,
): AutoHintMode =>
  autoHintsEnabled ? DEFAULT_AUTO_HINT_MODE : "no-auto-hints"

export const isAutoHintMode = (received: unknown): received is AutoHintMode =>
  typeof received === "string" &&
  (AUTO_HINT_MODES as readonly string[]).includes(received)

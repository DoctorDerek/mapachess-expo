import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"

export const AUTO_HINT_MODE_LABELS = Object.freeze({
  "auto-move-hints": "Auto Move Hints",
  "auto-piece-hints": "Auto Piece Hints",
  "no-auto-hints": "No Auto Hints",
}) satisfies Readonly<Record<AutoHintMode, string>>

export const autoHintModeLabel = (autoHintMode: AutoHintMode): string =>
  AUTO_HINT_MODE_LABELS[autoHintMode]

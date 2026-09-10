export const AUTO_HINT_MODES = [
  "auto-move-hints",
  "auto-piece-hints",
  "no-auto-hints",
] as const

export type AutoHintMode = (typeof AUTO_HINT_MODES)[number]

export const DEFAULT_AUTO_HINT_MODE: AutoHintMode = "auto-move-hints"

export const AUTO_HINT_MODE_PRESENTATION = Object.freeze({
  "auto-move-hints": {
    label: "Auto Move Hints",
    description:
      "Automatically show three Piece Hints and their Move Hints for each side.",
    medal: "Bronze if you win after using Move Hints.",
    medalTier: "bronze",
  },
  "auto-piece-hints": {
    label: "Auto Piece Hints",
    description:
      "Automatically show three Piece Hints for each side. Request Move Hints whenever you want.",
    medal: "Silver if you win with Piece Hints but no Move Hints.",
    medalTier: "silver",
  },
  "no-auto-hints": {
    label: "No Auto Hints",
    description: "Request Piece Hints or Move Hints whenever you want.",
    medal: "Gold if you win without using any hints.",
    medalTier: "gold",
  },
} as const satisfies Readonly<
  Record<
    AutoHintMode,
    Readonly<{
      label: string
      description: string
      medal: string
      medalTier: "bronze" | "silver" | "gold"
    }>
  >
>)

export const AUTO_HINT_MEDAL_EXPLANATION =
  "Medals reflect hints actually shown during the match. Changing this setting never erases earlier hint use."

export const autoHintModeLabel = (autoHintMode: AutoHintMode): string =>
  AUTO_HINT_MODE_PRESENTATION[autoHintMode].label

export const autoHintModeFromLegacyEnabled = (
  autoHintsEnabled: boolean,
): AutoHintMode => (autoHintsEnabled ? DEFAULT_AUTO_HINT_MODE : "no-auto-hints")

export const isAutoHintMode = (received: unknown): received is AutoHintMode =>
  typeof received === "string" &&
  (AUTO_HINT_MODES as readonly string[]).includes(received)

export type MatchNavigationOverlay =
  | "match-menu"
  | "match-details"
  | "settings"
  | "classifications"
  | "about-elo"
  | "reset-standard"
  | "reset-chess960"
  | "setup-opponent"
  | "setup-difficulty"
  | "setup-hints"
  | "rewards"

export type MatchNavigationScreen = "menu" | "setup" | "match"
export type MatchNavigationSetupKey =
  | "story:standard"
  | "story:chess960"
  | "challenge:standard"
  | "challenge:chess960"

export type MatchNavigationDestination = Readonly<{
  screen: MatchNavigationScreen
  matchId: string | null
  setupKey: MatchNavigationSetupKey
  overlays: readonly MatchNavigationOverlay[]
}>

const overlayNames: readonly MatchNavigationOverlay[] = [
  "match-menu",
  "match-details",
  "settings",
  "classifications",
  "about-elo",
  "reset-standard",
  "reset-chess960",
  "setup-opponent",
  "setup-difficulty",
  "setup-hints",
  "rewards",
]

export function parseMatchNavigationDestination(
  value: unknown,
): MatchNavigationDestination | null {
  if (typeof value !== "object" || value === null) return null
  if (
    !("screen" in value) ||
    (value.screen !== "menu" &&
      value.screen !== "setup" &&
      value.screen !== "match") ||
    !("matchId" in value) ||
    (value.matchId !== null && typeof value.matchId !== "string") ||
    !("overlays" in value) ||
    !Array.isArray(value.overlays) ||
    !("setupKey" in value) ||
    (value.setupKey !== "story:standard" &&
      value.setupKey !== "story:chess960" &&
      value.setupKey !== "challenge:standard" &&
      value.setupKey !== "challenge:chess960") ||
    (value.screen === "match" &&
      (typeof value.matchId !== "string" || value.matchId.length === 0))
  )
    return null
  const overlays: MatchNavigationOverlay[] = []
  for (const candidate of value.overlays) {
    const overlay = overlayNames.find((name) => name === candidate)
    if (overlay === undefined || overlays.includes(overlay)) return null
    overlays.push(overlay)
  }
  return {
    screen: value.screen,
    matchId: value.matchId,
    setupKey: value.setupKey,
    overlays,
  }
}

export function eligibleMatchNavigationOverlays(
  destination: MatchNavigationDestination,
  rewardAvailable: boolean,
): readonly MatchNavigationOverlay[] {
  const result: MatchNavigationOverlay[] = []
  for (const overlay of destination.overlays) {
    const eligible =
      overlay === "settings" ||
      ((overlay === "classifications" ||
        overlay === "about-elo" ||
        overlay === "reset-standard" ||
        overlay === "reset-chess960") &&
        result.includes("settings")) ||
      (overlay.startsWith("setup-") && destination.screen === "setup") ||
      (overlay === "match-menu" && destination.screen === "match") ||
      (overlay === "match-details" && result.includes("match-menu")) ||
      (overlay === "rewards" &&
        destination.screen === "match" &&
        rewardAvailable)
    if (eligible) result.push(overlay)
  }
  return result
}

export type MatchNavigationCommands = Readonly<{
  back: () => void
  open: (overlay: MatchNavigationOverlay) => void
}>

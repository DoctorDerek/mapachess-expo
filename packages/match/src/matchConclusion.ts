import loadCatalog, {
  type MapachessCatalog,
} from "@mapachess/localization/catalog"
import type { MatchColor, MatchPositionStatus } from "./matchPosition.js"
import { currentMatchPosition, type MatchTimeline } from "./matchTimeline.js"

export type MatchConclusion =
  | Readonly<{
      type: "checkmate"
      winner: MatchColor
    }>
  | Readonly<{
      type: "resignation"
      winner: MatchColor
    }>
  | Readonly<{ type: "draw-agreement" }>
  | Readonly<{ type: "insufficient-material" }>
  | Readonly<{ type: "stalemate" }>

export type MatchDrawOfferDecision = Readonly<{
  outcome: "accepted" | "rejected"
  positionFen: string
}>

export type RetainedMatchConclusion = Readonly<{
  conclusion: Extract<
    MatchConclusion,
    { type: "resignation" | "draw-agreement" }
  >
  cursor: number
}>

export const retainManualConclusion = (
  conclusion: MatchConclusion | null,
  cursor: number,
): RetainedMatchConclusion | null =>
  conclusion?.type === "resignation" || conclusion?.type === "draw-agreement"
    ? Object.freeze({ conclusion, cursor })
    : null

export const matchConclusionText = (
  conclusion: MatchConclusion,
  playerColor: MatchColor,
  opponentName: string,
  copy: MapachessCatalog["gameplay"]["conclusion"] = loadCatalog("en").gameplay
    .conclusion,
): string => {
  switch (conclusion.type) {
    case "checkmate":
      return conclusion.winner === playerColor
        ? copy.playerWon
        : copy.opponentWon(opponentName)
    case "resignation":
      return conclusion.winner === playerColor
        ? copy.opponentResigned(opponentName)
        : copy.playerResigned(opponentName)
    case "draw-agreement":
      return copy[conclusion.type]
    case "stalemate":
      return copy[conclusion.type]
    case "insufficient-material":
      return copy[conclusion.type]
  }
}

const oppositeColor = (color: MatchColor): MatchColor =>
  color === "white" ? "black" : "white"

export const deriveTerminalMatchConclusion = (
  status: MatchPositionStatus,
): MatchConclusion | null => {
  switch (status.type) {
    case "checkmate":
      return Object.freeze({ type: "checkmate", winner: status.winner })
    case "insufficient-material":
      return Object.freeze({ type: "insufficient-material" })
    case "stalemate":
      return Object.freeze({ type: "stalemate" })
    case "playing":
      return null
  }
}

export const createPlayerResignationConclusion = (
  playerColor: MatchColor,
): MatchConclusion =>
  Object.freeze({ type: "resignation", winner: oppositeColor(playerColor) })

export const createDrawAgreementConclusion = (): MatchConclusion =>
  Object.freeze({ type: "draw-agreement" })

export const deriveRetainedBranchConclusion = (
  timeline: MatchTimeline,
): MatchConclusion | null =>
  deriveTerminalMatchConclusion(currentMatchPosition(timeline).status)

export const conclusionMatchesRetainedBranch = (
  conclusion: MatchConclusion | null,
  timeline: MatchTimeline,
): boolean => {
  const terminalConclusion = deriveRetainedBranchConclusion(timeline)
  if (terminalConclusion !== null) {
    return terminalConclusion.type === "checkmate"
      ? conclusion?.type === "checkmate" &&
          conclusion.winner === terminalConclusion.winner
      : conclusion?.type === terminalConclusion.type
  }

  return (
    conclusion === null ||
    conclusion.type === "draw-agreement" ||
    conclusion.type === "resignation"
  )
}

import loadCatalog, {
  type MapachessCatalog,
} from "@mapachess/localization/catalog"
import {
  hasInsufficientMatingMaterial,
  type MatchColor,
  type MatchPosition,
  type MatchPositionStatus,
} from "./matchPosition.js"
import { currentMatchPosition, type MatchTimeline } from "./matchTimeline.js"

export type MatchConclusion =
  | Readonly<{ type: "timeout"; winner: MatchColor }>
  | Readonly<{ type: "timeout-insufficient-material" }>
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
    {
      type:
        | "resignation"
        | "draw-agreement"
        | "timeout"
        | "timeout-insufficient-material"
    }
  >
  cursor: number
}>

export const retainExplicitConclusion = (
  conclusion: MatchConclusion | null,
  cursor: number,
): RetainedMatchConclusion | null =>
  conclusion?.type === "resignation" ||
  conclusion?.type === "draw-agreement" ||
  conclusion?.type === "timeout" ||
  conclusion?.type === "timeout-insufficient-material"
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
    case "timeout":
      return conclusion.winner === playerColor
        ? copy.opponentTimedOut(opponentName)
        : copy.playerTimedOut
    case "timeout-insufficient-material":
      return copy[conclusion.type]
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

export const createTimeoutConclusion = (
  position: MatchPosition,
): MatchConclusion => {
  const winner = oppositeColor(position.turn)
  return hasInsufficientMatingMaterial(position, winner)
    ? Object.freeze({ type: "timeout-insufficient-material" })
    : Object.freeze({ type: "timeout", winner })
}

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

  if (
    conclusion === null ||
    conclusion.type === "draw-agreement" ||
    conclusion.type === "resignation"
  )
    return true
  const timeout = createTimeoutConclusion(currentMatchPosition(timeline))
  return (
    conclusion.type === timeout.type &&
    (timeout.type !== "timeout" ||
      (conclusion.type === "timeout" && conclusion.winner === timeout.winner))
  )
}

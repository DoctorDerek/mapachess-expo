import type { MatchColor, MatchPositionStatus } from "./matchPosition.js"
import type { MatchTimeline } from "./matchTimeline.js"

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
  deriveTerminalMatchConclusion(
    (timeline.transitions.at(-1)?.after ?? timeline.initialPosition).status,
  )

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

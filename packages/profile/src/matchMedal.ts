import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"

export const MATCH_MEDALS = ["bronze", "silver", "gold"] as const
export type MatchMedal = (typeof MATCH_MEDALS)[number]

type MedalResult = Pick<
  DurableMatchRecord,
  "conclusion" | "playerColor" | "moveHintsUsed" | "pieceHintsUsed"
>

export default function matchVictoryMedal(
  match: MedalResult,
): MatchMedal | null {
  if (
    (match.conclusion?.type !== "checkmate" &&
      match.conclusion?.type !== "resignation") ||
    match.conclusion.winner !== match.playerColor
  )
    return null
  if (match.moveHintsUsed && !match.pieceHintsUsed) {
    throw new TypeError(
      "Move Hints cannot award a medal without Piece Hint use.",
    )
  }
  return match.moveHintsUsed
    ? "bronze"
    : match.pieceHintsUsed
      ? "silver"
      : "gold"
}

export const highestMatchMedal = (
  previous: MatchMedal | null,
  candidate: MatchMedal | null,
): MatchMedal | null =>
  candidate !== null &&
  (previous === null ||
    MATCH_MEDALS.indexOf(candidate) > MATCH_MEDALS.indexOf(previous))
    ? candidate
    : previous

import loadCatalog from "@mapachess/localization/catalog"
import { HINT_ASSISTANCE_TIERS } from "@mapachess/match/auto-hint-mode"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"

export const MATCH_MEDALS = HINT_ASSISTANCE_TIERS
export type MatchMedal = (typeof MATCH_MEDALS)[number]

export const MATCH_MEDAL_HINT_USE = loadCatalog("en").shared.medalHintUse

type MedalResult = Pick<
  DurableMatchRecord,
  "conclusion" | "playerColor" | "moveHintsUsed" | "pieceHintsUsed"
>

export function matchMedalEligibility(
  hintUse: Pick<DurableMatchRecord, "moveHintsUsed" | "pieceHintsUsed">,
): MatchMedal {
  if (hintUse.moveHintsUsed && !hintUse.pieceHintsUsed)
    throw new TypeError(
      "Move Hints cannot award a medal without Piece Hint use.",
    )
  return hintUse.moveHintsUsed
    ? "bronze"
    : hintUse.pieceHintsUsed
      ? "silver"
      : "gold"
}

export default function matchVictoryMedal(
  match: MedalResult,
): MatchMedal | null {
  if (
    (match.conclusion?.type !== "checkmate" &&
      match.conclusion?.type !== "resignation" &&
      match.conclusion?.type !== "timeout") ||
    match.conclusion.winner !== match.playerColor
  )
    return null
  return matchMedalEligibility(match)
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

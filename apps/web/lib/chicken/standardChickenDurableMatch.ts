import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { WebMatchRuntime } from "../gameplay/webMatchRuntime"
import {
  selectStandardStoryPlayerColor,
  STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
  standardChickenMatchId,
} from "./standardChickenOpponent"

const STANDARD_CHICKEN_STARTING_POSITION = Object.freeze({
  chess960PositionId: null,
  variant: "standard" as const,
})

export type ResumedStandardChickenMatch = Readonly<{
  matchSeed: WebMatchRuntime["matchSeed"]
  timeline: MatchTimeline
}>

export type FreshStandardChickenMatchInput = Readonly<{
  autoHintsEnabledAtStart: boolean
  playerEloAtStart: number
  runtime: Pick<
    WebMatchRuntime,
    "matchId" | "matchSeed" | "opponentPolicyFingerprint" | "playerColor"
  >
}>

export function buildFreshStandardChickenMatch(
  input: FreshStandardChickenMatchInput,
): DurableMatchRecord {
  const initialPosition = createInitialMatchPosition(
    STANDARD_CHICKEN_STARTING_POSITION,
  )
  return Object.freeze({
    autoHintsEnabledAtStart: input.autoHintsEnabledAtStart,
    conclusion: null,
    currentFen: initialPosition.fen,
    cursor: 0,
    matchId: input.runtime.matchId,
    matchSeed: input.runtime.matchSeed,
    mode: "story",
    moveHintsUsed: false,
    moveIds: Object.freeze([]),
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: input.runtime.opponentPolicyFingerprint,
    pieceHintsUsed: false,
    playerColor: input.runtime.playerColor,
    playerEloAtStart: input.playerEloAtStart,
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition: STANDARD_CHICKEN_STARTING_POSITION,
    timeControl: Object.freeze({ type: "untimed" }),
  })
}

export default function resumeStandardChickenMatch(
  record: DurableMatchRecord,
): ResumedStandardChickenMatch {
  if (
    record.mode !== "story" ||
    record.opponentId !== "chicken-stockfish" ||
    record.startingPosition.variant !== "standard" ||
    record.startingPosition.chess960PositionId !== null
  ) {
    throw new TypeError("Saved match is not Standard Story Chicken.")
  }
  if (
    record.opponentPolicyFingerprint !== STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT
  ) {
    throw new TypeError("Saved Chicken policy does not match this runtime.")
  }

  const matchSeed = parseDeterministicRandomSeed(
    record.matchSeed,
    "Saved Standard Chicken match seed",
  )
  if (
    record.matchId !== standardChickenMatchId(matchSeed) ||
    record.playerColor !== selectStandardStoryPlayerColor(matchSeed)
  ) {
    throw new TypeError("Saved Chicken identity does not match its seed.")
  }

  const reconstruction = reconstructDurableMatch(record)
  if (!reconstruction.ok) {
    throw new TypeError(
      `Saved Chicken timeline could not reconstruct: ${reconstruction.error.type}`,
    )
  }

  return Object.freeze({
    matchSeed,
    timeline: reconstruction.timeline,
  })
}

import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import {
  chickenMatchId,
  chickenPolicyFingerprint,
  selectStoryPlayerColor,
} from "../chicken/chickenOpponent"
import type { WebMatchRuntime } from "./webMatchRuntime"

export type ResumedWebStoryMatch = Readonly<{
  matchSeed: WebMatchRuntime["matchSeed"]
  timeline: MatchTimeline
}>

export type FreshWebStoryMatchInput = Readonly<{
  autoHintMode: AutoHintMode
  playerEloAtStart: number
  runtime: Pick<
    WebMatchRuntime,
    | "matchId"
    | "matchSeed"
    | "opponentId"
    | "opponentPolicyFingerprint"
    | "playerColor"
    | "startingPosition"
  >
}>

export function buildFreshWebStoryMatch(
  input: FreshWebStoryMatchInput,
): DurableMatchRecord {
  const initialPosition = createInitialMatchPosition(
    input.runtime.startingPosition,
  )
  return Object.freeze({
    autoHintMode: input.autoHintMode,
    conclusion: null,
    currentFen: initialPosition.fen,
    cursor: 0,
    matchId: input.runtime.matchId,
    matchSeed: input.runtime.matchSeed,
    mode: "story",
    moveHintsUsed: false,
    moveIds: Object.freeze([]),
    opponentId: input.runtime.opponentId,
    opponentPolicyFingerprint: input.runtime.opponentPolicyFingerprint,
    pieceHintsUsed: false,
    playerColor: input.runtime.playerColor,
    playerEloAtStart: input.playerEloAtStart,
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition: input.runtime.startingPosition,
    timeControl: Object.freeze({ type: "untimed" }),
  })
}

export default function resumeWebStoryMatch(
  record: DurableMatchRecord,
): ResumedWebStoryMatch {
  if (record.mode !== "story" || record.opponentId !== "chicken-stockfish") {
    throw new TypeError("Saved match is not an implemented Story opponent.")
  }
  if (
    record.opponentPolicyFingerprint !==
    chickenPolicyFingerprint(record.startingPosition.variant)
  ) {
    throw new TypeError("Saved Chicken policy does not match this runtime.")
  }

  const matchSeed = parseDeterministicRandomSeed(
    record.matchSeed,
    "Saved Chicken match seed",
  )
  if (
    record.matchId !== chickenMatchId(matchSeed, record.startingPosition) ||
    record.playerColor !== selectStoryPlayerColor(matchSeed)
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

import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
  type MatchMode,
} from "@mapachess/match/durable-match-record"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { WebMatchRuntime } from "./webMatchRuntime"
import { selectStoryPlayerColor, webMatchId } from "./webOpponent"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
} from "./webOpponentPolicy"

export type ResumedWebMatch = Readonly<{
  matchSeed: WebMatchRuntime["matchSeed"]
  timeline: MatchTimeline
}>

export type FreshWebMatchInput = Readonly<{
  autoHintMode: AutoHintMode
  mode?: MatchMode
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

export function buildFreshWebMatch(
  input: FreshWebMatchInput,
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
    mode: input.mode ?? "story",
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

export default async function resumeWebMatch(
  record: DurableMatchRecord,
): Promise<ResumedWebMatch> {
  if (record.mode === "challenge")
    await resolveWebChallengePolicy(
      record.opponentId,
      record.startingPosition.variant,
      undefined,
      record.opponentPolicyFingerprint,
    )
  else
    await resolveWebOpponentPolicy(
      record.opponentId,
      record.startingPosition.variant,
      record.opponentPolicyFingerprint,
    )

  const matchSeed = parseDeterministicRandomSeed(
    record.matchSeed,
    "Saved opponent match seed",
  )
  if (
    record.matchId !==
      webMatchId(
        matchSeed,
        record.startingPosition,
        { mode: record.mode, playerColor: record.playerColor },
        record.opponentId,
      ) ||
    (record.mode === "story" &&
      record.playerColor !== selectStoryPlayerColor(matchSeed))
  ) {
    throw new TypeError("Saved opponent identity does not match its seed.")
  }

  const reconstruction = reconstructDurableMatch(record)
  if (!reconstruction.ok) {
    throw new TypeError(
      `Saved opponent timeline could not reconstruct: ${reconstruction.error.type}`,
    )
  }

  return Object.freeze({
    matchSeed,
    timeline: reconstruction.timeline,
  })
}

import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
  type MatchMode,
  type StartingPlayerElos,
} from "@mapachess/match/durable-match-record"
import {
  createMatchClock,
  durableMatchClock,
} from "@mapachess/match/match-clock"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import { UNTIMED, type TimeControl } from "@mapachess/match/time-control"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { WebMatchRuntime } from "./webMatchRuntime"
import { selectStoryPlayerColor, webMatchId } from "./webOpponent"

export type ResumedWebMatch = Readonly<{
  matchSeed: WebMatchRuntime["matchSeed"]
  timeline: MatchTimeline
}>

export type FreshWebMatchInput = Readonly<{
  timeControl?: TimeControl
  autoHintMode: AutoHintMode
  mode?: MatchMode
  playerEloAtStart: number
  playerElosAtStart?: StartingPlayerElos
  runtime: Pick<
    WebMatchRuntime,
    | "matchId"
    | "matchSeed"
    | "opponentId"
    | "opponentTargetElo"
    | "opponentPolicyFingerprint"
    | "ratedOpponentElo"
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
  const timeControl = input.timeControl ?? UNTIMED
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
    opponentTargetElo: input.runtime.opponentTargetElo,
    ratedOpponentElo: input.runtime.ratedOpponentElo,
    opponentPolicyFingerprint: input.runtime.opponentPolicyFingerprint,
    pieceHintsUsed: false,
    playerColor: input.runtime.playerColor,
    playerEloAtStart: input.playerEloAtStart,
    ...(input.playerElosAtStart === undefined
      ? {}
      : { playerElosAtStart: Object.freeze({ ...input.playerElosAtStart }) }),
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition: input.runtime.startingPosition,
    timeControl,
    ...(timeControl.type === "untimed"
      ? {}
      : {
          clock: durableMatchClock(
            createMatchClock(timeControl, initialPosition.turn),
          ),
        }),
  })
}

export default function resumeWebMatch(
  record: DurableMatchRecord,
): ResumedWebMatch {
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

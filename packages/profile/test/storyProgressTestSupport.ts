import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { deriveRetainedBranchConclusion } from "@mapachess/match/match-conclusion"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "@mapachess/match/match-timeline"
import type { MatchVariant } from "@mapachess/match/match-variant"

export default function completedStoryMatch(
  variant: MatchVariant = "standard",
): DurableMatchRecord {
  const positionId = parseChess960PositionId(518)
  if (!positionId.ok) throw new Error("Orthodox Chess960 layout must parse")
  const startingPosition: MatchStartingPosition =
    variant === "standard"
      ? { variant, chess960PositionId: null }
      : { variant, chess960PositionId: positionId.positionId }
  let timeline = createMatchTimeline(
    createInitialMatchPosition(startingPosition),
  )
  for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
    const move = parseMatchMoveId(uci)
    if (!move.ok) throw new Error("Fixture move must parse")
    const applied = applyMatchTimelineMove(timeline, move.moveId)
    if (!applied.ok) throw new Error("Fixture must be a legal game")
    timeline = applied.timeline
  }
  const conclusion = deriveRetainedBranchConclusion(timeline)
  if (conclusion?.type !== "checkmate" || conclusion.winner !== "black") {
    throw new Error("Fixture must end in checkmate for Black")
  }
  return Object.freeze({
    autoHintMode: "no-auto-hints",
    conclusion,
    currentFen: currentMatchPosition(timeline).fen,
    cursor: timeline.cursor,
    matchId: `${variant}-story-chicken/progression-fixture`,
    matchSeed: "00000001000000020000000300000004",
    mode: "story",
    moveHintsUsed: false,
    moveIds: Object.freeze(timeline.transitions.map(({ move }) => move.id)),
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: "synthetic-story-progression-policy/v1",
    pieceHintsUsed: false,
    playerColor: "black",
    playerEloAtStart: 100,
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition,
    timeControl: Object.freeze({ type: "untimed" }),
  })
}

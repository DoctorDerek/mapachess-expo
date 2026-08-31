import type { DurableMatchRecord } from "./durableMatchRecord.js"
import { createInitialMatchPosition } from "./matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
  type MatchTimeline,
} from "./matchTimeline.js"

export type DurableMatchReconstructionError =
  | Readonly<{
      cursor: number
      transitionCount: number
      type: "MATCH.DURABLE_CURSOR_INVALID"
    }>
  | Readonly<{
      moveId: string
      moveIndex: number
      type: "MATCH.DURABLE_MOVE_ILLEGAL"
    }>
  | Readonly<{
      derivedFen: string
      storedFen: string
      type: "MATCH.DURABLE_CURRENT_FEN_MISMATCH"
    }>

export type DurableMatchReconstructionResult =
  | Readonly<{
      ok: true
      timeline: MatchTimeline
    }>
  | Readonly<{
      error: DurableMatchReconstructionError
      ok: false
    }>

const replayMoveBranch = (
  record: DurableMatchRecord,
): DurableMatchReconstructionResult => {
  let timeline = createMatchTimeline(
    createInitialMatchPosition(record.startingPosition),
  )

  for (const [moveIndex, moveId] of record.moveIds.entries()) {
    const result = applyMatchTimelineMove(timeline, moveId)
    if (!result.ok) {
      return {
        error: Object.freeze({
          moveId,
          moveIndex,
          type: "MATCH.DURABLE_MOVE_ILLEGAL",
        }),
        ok: false,
      }
    }
    timeline = result.timeline
  }

  return { ok: true, timeline }
}

export default function reconstructDurableMatch(
  record: DurableMatchRecord,
): DurableMatchReconstructionResult {
  if (record.cursor > record.moveIds.length) {
    return {
      error: Object.freeze({
        cursor: record.cursor,
        transitionCount: record.moveIds.length,
        type: "MATCH.DURABLE_CURSOR_INVALID",
      }),
      ok: false,
    }
  }

  const replayed = replayMoveBranch(record)
  if (!replayed.ok) return replayed

  const timeline = Object.freeze({
    ...replayed.timeline,
    cursor: record.cursor,
  })
  const derivedFen = currentMatchPosition(timeline).fen
  if (derivedFen !== record.currentFen) {
    return {
      error: Object.freeze({
        derivedFen,
        storedFen: record.currentFen,
        type: "MATCH.DURABLE_CURRENT_FEN_MISMATCH",
      }),
      ok: false,
    }
  }

  return { ok: true, timeline }
}

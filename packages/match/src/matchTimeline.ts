import {
  applyMatchMove,
  type MatchMoveApplicationResult,
  type MatchMoveId,
  type MatchMoveTransition,
} from "./matchMove.js"
import type { MatchPosition } from "./matchPosition.js"

export type MatchTimeline = Readonly<{
  cursor: number
  initialPosition: MatchPosition
  transitions: readonly MatchMoveTransition[]
}>

export type MatchTimelineNavigationResult =
  | Readonly<{
      ok: true
      timeline: MatchTimeline
    }>
  | Readonly<{
      error: Readonly<{
        type: "MATCH.UNDO_UNAVAILABLE" | "MATCH.REDO_UNAVAILABLE"
      }>
      ok: false
    }>

export type MatchTimelineMoveResult =
  | Readonly<{
      ok: true
      timeline: MatchTimeline
      transition: MatchMoveTransition
    }>
  | Exclude<MatchMoveApplicationResult, { ok: true }>

export const createMatchTimeline = (
  initialPosition: MatchPosition,
): MatchTimeline =>
  Object.freeze({
    cursor: 0,
    initialPosition,
    transitions: Object.freeze([]),
  })

export const currentMatchPosition = (timeline: MatchTimeline): MatchPosition =>
  timeline.cursor === 0
    ? timeline.initialPosition
    : currentTransitionPosition(timeline)

const currentTransitionPosition = (timeline: MatchTimeline): MatchPosition => {
  const transition = timeline.transitions[timeline.cursor - 1]
  if (!transition) {
    throw new Error("Match timeline cursor has no corresponding transition")
  }
  return transition.after
}

export const canUndoMatchTimeline = (timeline: MatchTimeline): boolean =>
  timeline.cursor > 0

export const canRedoMatchTimeline = (timeline: MatchTimeline): boolean =>
  timeline.cursor < timeline.transitions.length

export const applyMatchTimelineMove = (
  timeline: MatchTimeline,
  moveId: MatchMoveId,
): MatchTimelineMoveResult => {
  const result = applyMatchMove(currentMatchPosition(timeline), moveId)
  if (!result.ok) {
    return result
  }

  const retainedTransitions = timeline.transitions.slice(0, timeline.cursor)
  const transitions = Object.freeze([...retainedTransitions, result.transition])
  return {
    ok: true,
    timeline: Object.freeze({
      cursor: transitions.length,
      initialPosition: timeline.initialPosition,
      transitions,
    }),
    transition: result.transition,
  }
}

export const undoMatchTimeline = (
  timeline: MatchTimeline,
): MatchTimelineNavigationResult =>
  canUndoMatchTimeline(timeline)
    ? {
        ok: true,
        timeline: Object.freeze({
          ...timeline,
          cursor: timeline.cursor - 1,
        }),
      }
    : {
        error: { type: "MATCH.UNDO_UNAVAILABLE" },
        ok: false,
      }

export const redoMatchTimeline = (
  timeline: MatchTimeline,
): MatchTimelineNavigationResult =>
  canRedoMatchTimeline(timeline)
    ? {
        ok: true,
        timeline: Object.freeze({
          ...timeline,
          cursor: timeline.cursor + 1,
        }),
      }
    : {
        error: { type: "MATCH.REDO_UNAVAILABLE" },
        ok: false,
      }

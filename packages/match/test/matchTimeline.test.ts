import { describe, expect, it } from "vitest"
import { listLegalMatchMoves } from "../src/matchMove"
import { createInitialMatchPosition } from "../src/matchPosition"
import {
  applyMatchTimelineMove,
  canRedoMatchTimeline,
  canUndoMatchTimeline,
  createMatchTimeline,
  currentMatchPosition,
  redoMatchTimeline,
  undoMatchTimeline,
  type MatchTimeline,
} from "../src/matchTimeline"
import { requireLegalMove } from "./matchTestUtils"

const play = (timeline: MatchTimeline, uci: string): MatchTimeline => {
  const position = currentMatchPosition(timeline)
  const result = applyMatchTimelineMove(
    timeline,
    requireLegalMove(position, uci).id,
  )
  if (!result.ok) {
    throw new Error(`Could not apply timeline move ${uci}`)
  }
  return result.timeline
}

describe("exact reversible match timeline", () => {
  it("stores exact states for unlimited Undo and Redo", () => {
    const initialPosition = createInitialMatchPosition({
      chess960PositionId: null,
      variant: "standard",
    })
    const initialTimeline = createMatchTimeline(initialPosition)
    const afterE4 = play(initialTimeline, "e2e4")
    const afterE5 = play(afterE4, "e7e5")
    const terminalReference = currentMatchPosition(afterE5)

    const firstUndo = undoMatchTimeline(afterE5)
    expect(firstUndo.ok).toBe(true)
    if (!firstUndo.ok) return
    expect(currentMatchPosition(firstUndo.timeline)).toBe(
      currentMatchPosition(afterE4),
    )

    const secondUndo = undoMatchTimeline(firstUndo.timeline)
    expect(secondUndo.ok).toBe(true)
    if (!secondUndo.ok) return
    expect(currentMatchPosition(secondUndo.timeline)).toBe(initialPosition)

    const firstRedo = redoMatchTimeline(secondUndo.timeline)
    expect(firstRedo.ok).toBe(true)
    if (!firstRedo.ok) return
    const secondRedo = redoMatchTimeline(firstRedo.timeline)
    expect(secondRedo.ok).toBe(true)
    if (!secondRedo.ok) return

    expect(currentMatchPosition(secondRedo.timeline)).toBe(terminalReference)
    expect(canUndoMatchTimeline(secondRedo.timeline)).toBe(true)
    expect(canRedoMatchTimeline(secondRedo.timeline)).toBe(false)
  })

  it("clears the abandoned Redo branch after a new accepted move", () => {
    const initialTimeline = createMatchTimeline(
      createInitialMatchPosition({
        chess960PositionId: null,
        variant: "standard",
      }),
    )
    const afterE5 = play(play(initialTimeline, "e2e4"), "e7e5")
    const undone = undoMatchTimeline(afterE5)
    if (!undone.ok) throw new Error("Expected Undo to succeed")

    const diverged = play(undone.timeline, "d7d5")

    expect(diverged.transitions.map((entry) => entry.move.uci)).toEqual([
      "e2e4",
      "d7d5",
    ])
    expect(canRedoMatchTimeline(diverged)).toBe(false)
    expect(
      listLegalMatchMoves(currentMatchPosition(diverged)),
    ).not.toHaveLength(0)
  })

  it("reports unavailable timeline navigation without mutation", () => {
    const timeline = createMatchTimeline(
      createInitialMatchPosition({
        chess960PositionId: null,
        variant: "standard",
      }),
    )

    expect(undoMatchTimeline(timeline)).toEqual({
      error: { type: "MATCH.UNDO_UNAVAILABLE" },
      ok: false,
    })
    expect(redoMatchTimeline(timeline)).toEqual({
      error: { type: "MATCH.REDO_UNAVAILABLE" },
      ok: false,
    })
  })
})

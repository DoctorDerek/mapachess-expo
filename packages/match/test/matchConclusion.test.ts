import { describe, expect, it } from "vitest"
import {
  conclusionMatchesRetainedBranch,
  createDrawAgreementConclusion,
  createPlayerResignationConclusion,
  deriveRetainedBranchConclusion,
  deriveTerminalMatchConclusion,
} from "../src/matchConclusion.js"
import { createInitialMatchPosition } from "../src/matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
  type MatchTimeline,
} from "../src/matchTimeline.js"
import { requireLegalMove } from "./matchTestUtils.js"

const createStandardTimeline = (): MatchTimeline =>
  createMatchTimeline(
    createInitialMatchPosition({
      chess960PositionId: null,
      variant: "standard",
    }),
  )

const applyMoves = (
  initialTimeline: MatchTimeline,
  moveUcis: readonly string[],
): MatchTimeline => {
  let timeline = initialTimeline
  for (const moveUci of moveUcis) {
    const move = requireLegalMove(currentMatchPosition(timeline), moveUci)
    const result = applyMatchTimelineMove(timeline, move.id)
    if (!result.ok) throw new Error(`Test move ${moveUci} must apply.`)
    timeline = result.timeline
  }
  return timeline
}

describe("canonical match conclusions", () => {
  it("derives every terminal chess reason without inventing active results", () => {
    expect(deriveTerminalMatchConclusion({ type: "playing" })).toBeNull()
    expect(
      deriveTerminalMatchConclusion({ type: "checkmate", winner: "black" }),
    ).toEqual({ type: "checkmate", winner: "black" })
    expect(deriveTerminalMatchConclusion({ type: "stalemate" })).toEqual({
      type: "stalemate",
    })
    expect(
      deriveTerminalMatchConclusion({ type: "insufficient-material" }),
    ).toEqual({ type: "insufficient-material" })
  })

  it("creates player-owned resignation and draw-agreement conclusions", () => {
    expect(createPlayerResignationConclusion("white")).toEqual({
      type: "resignation",
      winner: "black",
    })
    expect(createPlayerResignationConclusion("black")).toEqual({
      type: "resignation",
      winner: "white",
    })
    expect(createDrawAgreementConclusion()).toEqual({
      type: "draw-agreement",
    })
  })

  it("keeps a terminal result tied to the retained branch during review", () => {
    const completedTimeline = applyMoves(createStandardTimeline(), [
      "f2f3",
      "e7e5",
      "g2g4",
      "d8h4",
    ])
    const reviewTimeline = Object.freeze({
      ...completedTimeline,
      cursor: 0,
    })

    expect(deriveRetainedBranchConclusion(reviewTimeline)).toEqual({
      type: "checkmate",
      winner: "black",
    })
    expect(
      conclusionMatchesRetainedBranch(
        { type: "checkmate", winner: "black" },
        reviewTimeline,
      ),
    ).toBe(true)
    expect(
      conclusionMatchesRetainedBranch(
        { type: "draw-agreement" },
        reviewTimeline,
      ),
    ).toBe(false)
    expect(conclusionMatchesRetainedBranch(null, reviewTimeline)).toBe(false)
  })

  it("permits only voluntary conclusions on an active branch", () => {
    const timeline = createStandardTimeline()

    expect(conclusionMatchesRetainedBranch(null, timeline)).toBe(true)
    expect(
      conclusionMatchesRetainedBranch({ type: "draw-agreement" }, timeline),
    ).toBe(true)
    expect(
      conclusionMatchesRetainedBranch(
        { type: "resignation", winner: "black" },
        timeline,
      ),
    ).toBe(true)
    expect(
      conclusionMatchesRetainedBranch(
        { type: "checkmate", winner: "black" },
        timeline,
      ),
    ).toBe(false)
  })
})

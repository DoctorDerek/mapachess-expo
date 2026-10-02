import { describe, expect, it } from "vitest"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  type MatchTimeline,
} from "@mapachess/match/match-timeline"
import {
  deriveAcceptedMatchPresentationUpdate,
  deriveConcludingMatchPresentationPhases,
  deriveConclusionPresentationPhase,
} from "../src/matchPresentationObservation"

const initial = createMatchTimeline(
  createInitialMatchPosition({
    variant: "standard",
    chess960PositionId: null,
  }),
)
const advance = (timeline: MatchTimeline, moves: readonly string[]) =>
  moves.reduce((before, move) => {
    const parsed = parseMatchMoveId(move)
    if (!parsed.ok) throw new Error("Invalid fixture move")
    const accepted = applyMatchTimelineMove(before, parsed.moveId)
    if (!accepted.ok) throw new Error("Illegal fixture move")
    return accepted.timeline
  }, timeline)
const beforeCaptures = advance(initial, ["e2e4", "d7d5"])
const captures = advance(beforeCaptures, ["e4d5", "d8d5"])

describe("accepted animal-performance observation", () => {
  it("replays only the finishing capture/check and actual conclusion", () => {
    const mate = advance(initial, [
      "e2e4",
      "e7e5",
      "f1c4",
      "b8c6",
      "d1h5",
      "g8f6",
      "h5f7",
    ])
    const phases = deriveConcludingMatchPresentationPhases(
      {
        timeline: mate,
        conclusion: { type: "checkmate", winner: "white" },
      },
      "black",
    )
    expect(phases.map((phase) => phase.kind)).toEqual([
      "capture",
      "check",
      "conclusion",
    ])
    expect(phases[0]?.opponent).toEqual({ family: "capture", role: "attacker" })
    expect(phases.at(-1)).toMatchObject({
      terminalDefeat: true,
      player: { family: "defeat" },
    })
    expect(
      deriveConcludingMatchPresentationPhases(
        {
          timeline: captures,
          conclusion: { type: "resignation", winner: "white" },
        },
        "white",
      ),
    ).toEqual([
      deriveConclusionPresentationPhase({
        conclusion: { type: "resignation", winner: "white" },
        playerColor: "white",
      }),
    ])
    expect(
      deriveConcludingMatchPresentationPhases(
        { timeline: captures, conclusion: { type: "draw-agreement" } },
        "white",
      ),
    ).toEqual([])
    expect(
      deriveConcludingMatchPresentationPhases(
        { timeline: captures, conclusion: null },
        "white",
      ),
    ).toEqual([])
  })

  it("does not fabricate a capture for a quiet finishing checkmate", () => {
    const mate = advance(initial, ["f2f3", "e7e5", "g2g4", "d8h4"])
    expect(
      deriveConcludingMatchPresentationPhases(
        { timeline: mate, conclusion: { type: "checkmate", winner: "black" } },
        "white",
      ).map((phase) => phase.kind),
    ).toEqual(["check", "conclusion"])
  })
  it("includes both captures delivered in one snapshot, in move order", () => {
    const update = deriveAcceptedMatchPresentationUpdate(
      { timeline: beforeCaptures, conclusion: null },
      { timeline: captures, conclusion: null },
      "white",
    )
    expect(update.reset).toBe(false)
    expect(update.phases.map((p) => p.player)).toEqual([
      { family: "capture", role: "attacker" },
      { family: "capture", role: "victim" },
    ])
    expect(
      deriveAcceptedMatchPresentationUpdate(
        { timeline: captures, conclusion: null },
        { timeline: captures, conclusion: null },
        "white",
      ),
    ).toEqual({ phases: [], reset: false })
  })

  it("does not reset an unfinished performance for a quiet move or draw", () => {
    const quiet = advance(captures, ["b1c3"])
    expect(
      deriveAcceptedMatchPresentationUpdate(
        { timeline: captures, conclusion: null },
        { timeline: quiet, conclusion: null },
        "white",
      ),
    ).toEqual({ phases: [], reset: false })
    expect(
      deriveAcceptedMatchPresentationUpdate(
        { timeline: quiet, conclusion: null },
        { timeline: quiet, conclusion: { type: "draw-agreement" } },
        "white",
      ),
    ).toEqual({ phases: [], reset: false })
  })

  it("invalidates Undo, Redo, and abandoned branches without replay", () => {
    const undone = { ...captures, cursor: 2 }
    expect(
      deriveAcceptedMatchPresentationUpdate(
        { timeline: captures, conclusion: null },
        { timeline: undone, conclusion: null },
        "white",
      ),
    ).toEqual({ phases: [], reset: true })
    expect(
      deriveAcceptedMatchPresentationUpdate(
        { timeline: undone, conclusion: null },
        { timeline: captures, conclusion: null },
        "white",
      ),
    ).toEqual({ phases: [], reset: true })
    expect(
      deriveAcceptedMatchPresentationUpdate(
        { timeline: undone, conclusion: null },
        { timeline: advance(undone, ["e4e5"]), conclusion: null },
        "white",
      ),
    ).toEqual({ phases: [], reset: true })
  })

  it("adds the final conclusion once after all accepted move performances", () => {
    const mate = advance(initial, [
      "e2e4",
      "e7e5",
      "f1c4",
      "b8c6",
      "d1h5",
      "g8f6",
      "h5f7",
    ])
    const update = deriveAcceptedMatchPresentationUpdate(
      { timeline: initial, conclusion: null },
      { timeline: mate, conclusion: { type: "checkmate", winner: "white" } },
      "white",
    )
    expect(update.phases.map((p) => p.kind)).toEqual([
      "capture",
      "check",
      "conclusion",
    ])
    expect(update.phases.at(-1)?.terminalDefeat).toBe(true)
    expect(
      deriveConclusionPresentationPhase({
        conclusion: { type: "resignation", winner: "black" },
        playerColor: "white",
      }),
    ).toMatchObject({ terminalDefeat: false, player: { family: "defeat" } })
  })
})

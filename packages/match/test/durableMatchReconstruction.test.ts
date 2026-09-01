import { describe, expect, it } from "vitest"
import reconstructDurableMatch from "../src/durableMatchReconstruction.js"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "../src/durableMatchRecord.js"
import { parseMatchMoveId } from "../src/matchMove.js"
import {
  createInitialMatchPosition,
  type MatchStartingPosition,
} from "../src/matchPosition.js"
import {
  applyMatchTimelineMove,
  canRedoMatchTimeline,
  createMatchTimeline,
  currentMatchPosition,
} from "../src/matchTimeline.js"
import {
  requireChess960PositionId,
  requireLegalMove,
} from "./matchTestUtils.js"

const standardStartingPosition = Object.freeze({
  chess960PositionId: null,
  variant: "standard" as const,
})

const requireSyntacticMoveId = (uci: string) => {
  const result = parseMatchMoveId(uci)
  if (!result.ok) throw new Error(`Invalid test move ID ${uci}`)
  return result.moveId
}

const createRecord = (
  moveUcis: readonly string[],
  cursor = moveUcis.length,
  startingPosition: MatchStartingPosition = standardStartingPosition,
): DurableMatchRecord => {
  let timeline = createMatchTimeline(
    createInitialMatchPosition(startingPosition),
  )
  const positions = [currentMatchPosition(timeline)]
  const moveIds = moveUcis.map((uci) => {
    const moveId = requireLegalMove(currentMatchPosition(timeline), uci).id
    const result = applyMatchTimelineMove(timeline, moveId)
    if (!result.ok) throw new Error(`Could not build test move ${uci}`)
    timeline = result.timeline
    positions.push(currentMatchPosition(timeline))
    return moveId
  })
  const currentPosition = positions[cursor]
  if (currentPosition === undefined) {
    throw new Error("Test record cursor has no position")
  }

  return Object.freeze({
    autoHintsEnabledAtStart: true,
    conclusion: null,
    currentFen: currentPosition.fen,
    cursor,
    matchId: "durable-reconstruction-test",
    matchSeed: "0123456789abcdef0123456789abcdef",
    mode: "story",
    moveHintsUsed: false,
    moveIds: Object.freeze(moveIds),
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: "chicken-test-policy",
    pieceHintsUsed: false,
    playerColor: "white",
    playerEloAtStart: 100,
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition,
    timeControl: Object.freeze({ type: "untimed" }),
  })
}

describe("durable match reconstruction", () => {
  it("replays the full branch while restoring its exact Undo cursor", () => {
    const record = createRecord(["e2e4", "e7e5"], 1)
    const result = reconstructDurableMatch(record)
    if (!result.ok) throw new Error("Valid durable match must reconstruct")

    expect(result.timeline.transitions.map(({ move }) => move.uci)).toEqual([
      "e2e4",
      "e7e5",
    ])
    expect(result.timeline.cursor).toBe(1)
    expect(currentMatchPosition(result.timeline).fen).toBe(record.currentFen)
    expect(canRedoMatchTimeline(result.timeline)).toBe(true)
  })

  it("rejects a syntactic move that is illegal in the replayed position", () => {
    const record = createRecord([])
    const illegalMove = requireSyntacticMoveId("e2e5")

    expect(
      reconstructDurableMatch({
        ...record,
        cursor: 1,
        moveIds: Object.freeze([illegalMove]),
      }),
    ).toEqual({
      error: {
        moveId: illegalMove,
        moveIndex: 0,
        type: "MATCH.DURABLE_MOVE_ILLEGAL",
      },
      ok: false,
    })
  })

  it("rejects a cursor beyond the retained move branch", () => {
    const record = createRecord(["e2e4"])

    expect(reconstructDurableMatch({ ...record, cursor: 2 })).toEqual({
      error: {
        cursor: 2,
        transitionCount: 1,
        type: "MATCH.DURABLE_CURSOR_INVALID",
      },
      ok: false,
    })
  })

  it("rejects stored current FEN that disagrees with replay", () => {
    const record = createRecord(["e2e4"])
    const initialFen = createInitialMatchPosition(standardStartingPosition).fen
    const result = reconstructDurableMatch({
      ...record,
      currentFen: initialFen,
    })

    expect(result).toEqual({
      error: {
        derivedFen: record.currentFen,
        storedFen: initialFen,
        type: "MATCH.DURABLE_CURRENT_FEN_MISMATCH",
      },
      ok: false,
    })
  })

  it("derives terminal chess status instead of accepting persisted status", () => {
    const record = createRecord(["f2f3", "e7e5", "g2g4", "d8h4"])
    const result = reconstructDurableMatch(record)
    if (!result.ok) throw new Error("Terminal durable match must reconstruct")

    expect(currentMatchPosition(result.timeline).status).toEqual({
      type: "checkmate",
      winner: "black",
    })
  })

  it("reconstructs the canonical Chess960 starting position", () => {
    const startingPosition = Object.freeze({
      chess960PositionId: requireChess960PositionId(518),
      variant: "chess960" as const,
    })
    const record = createRecord([], 0, startingPosition)
    const result = reconstructDurableMatch(record)
    if (!result.ok) throw new Error("Chess960 record must reconstruct")

    expect(currentMatchPosition(result.timeline)).toMatchObject({
      chess960PositionId: startingPosition.chess960PositionId,
      variant: "chess960",
    })
  })
})

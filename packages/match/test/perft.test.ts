import { describe, expect, it } from "vitest"
import { applyMatchMove, listLegalMatchMoves } from "../src/matchMove"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
} from "../src/matchPosition"
import { requireChess960PositionId } from "./matchTestUtils"

const countPerftNodes = (position: MatchPosition, depth: number): number => {
  if (depth === 0) return 1

  let nodes = 0
  for (const move of listLegalMatchMoves(position)) {
    const result = applyMatchMove(position, move.id)
    if (!result.ok) {
      throw new Error(`Generated illegal move ${move.id}`)
    }
    nodes += countPerftNodes(result.transition.after, depth - 1)
  }
  return nodes
}

describe("authoritative move-generation references", () => {
  it("matches the orthodox starting-position perft through depth three", () => {
    const position = createInitialMatchPosition({
      chess960PositionId: null,
      variant: "standard",
    })

    expect(countPerftNodes(position, 1)).toBe(20)
    expect(countPerftNodes(position, 2)).toBe(400)
    expect(countPerftNodes(position, 3)).toBe(8_902)
  })

  it("matches the Stockfish Chess960 perft reference through depth two", () => {
    const result = reconstructMatchPosition(
      {
        chess960PositionId: requireChess960PositionId(518),
        variant: "chess960",
      },
      "rr6/2kpp3/1ppn2p1/p2b1q1p/P4P1P/1PNN2P1/2PP4/1K2R2R b E - 1 20",
    )
    if (!result.ok) throw new Error("Invalid Chess960 perft fixture")

    expect(countPerftNodes(result.position, 2)).toBe(1_438)
  })
})

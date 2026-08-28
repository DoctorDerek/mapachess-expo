import { describe, expect, it } from "vitest"
import { applyMatchMove, listLegalMatchMoves } from "../src/matchMove"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
  type MatchStartingPosition,
} from "../src/matchPosition"
import {
  requireAppliedMove,
  requireChess960PositionId,
  requireLegalMove,
} from "./matchTestUtils"

const standardStartingPosition: MatchStartingPosition = {
  chess960PositionId: null,
  variant: "standard",
}

const requirePosition = (
  startingPosition: MatchStartingPosition,
  fen: string,
): MatchPosition => {
  const result = reconstructMatchPosition(startingPosition, fen)
  if (!result.ok) {
    throw new Error(`Invalid test FEN ${fen}`)
  }
  return result.position
}

describe("legal match moves", () => {
  it("lists and applies orthodox opening moves with SAN and UCI", () => {
    const initialPosition = createInitialMatchPosition(standardStartingPosition)
    const legalMoves = listLegalMatchMoves(initialPosition)
    const e4 = requireLegalMove(initialPosition, "e2e4")

    expect(legalMoves).toHaveLength(20)
    expect(e4).toEqual({
      from: "e2",
      id: "e2e4",
      kind: "normal",
      promotion: null,
      san: "e4",
      to: "e4",
      uci: "e2e4",
    })

    const result = applyMatchMove(initialPosition, e4.id)
    expect(result).toMatchObject({
      ok: true,
      transition: {
        after: { turn: "black" },
        before: initialPosition,
        move: {
          beforeFen: initialPosition.fen,
          id: e4.id,
          san: "e4",
        },
      },
    })
  })

  it("rejects a formerly legal move after the position changes", () => {
    const initialPosition = createInitialMatchPosition(standardStartingPosition)
    const e4 = requireLegalMove(initialPosition, "e2e4")
    const afterE4 = requireAppliedMove(initialPosition, "e2e4").after

    expect(applyMatchMove(afterE4, e4.id)).toEqual({
      error: { moveId: e4.id, type: "MATCH.MOVE_ILLEGAL" },
      ok: false,
    })
  })

  it("creates all four legal promotion choices", () => {
    const position = requirePosition(
      standardStartingPosition,
      "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    )
    const promotions = listLegalMatchMoves(position).filter(
      (move) => move.from === "a7" && move.to === "a8",
    )

    expect(promotions.map((move) => move.uci).sort()).toEqual([
      "a7a8b",
      "a7a8n",
      "a7a8q",
      "a7a8r",
    ])
    expect(requireAppliedMove(position, "a7a8q").after.pieces).toContainEqual({
      color: "white",
      role: "queen",
      square: "a8",
    })
  })

  it("applies en passant captures through canonical position reconstruction", () => {
    const position = requirePosition(
      standardStartingPosition,
      "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
    )
    const afterCapture = requireAppliedMove(position, "e5d6").after

    expect(afterCapture.pieces).toContainEqual({
      color: "white",
      role: "pawn",
      square: "d6",
    })
    expect(afterCapture.pieces).not.toContainEqual({
      color: "black",
      role: "pawn",
      square: "d5",
    })
  })

  it("represents orthodox castling semantically and emits standard UCI", () => {
    const position = requirePosition(
      standardStartingPosition,
      "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    )
    const castle = requireLegalMove(position, "e1g1")

    expect(castle).toEqual({
      from: "e1",
      id: "e1h1",
      kind: "castle",
      rookFrom: "h1",
      rookTo: "f1",
      san: "O-O",
      side: "king",
      to: "g1",
      uci: "e1g1",
    })
    expect(requireAppliedMove(position, "e1g1").after.pieces).toEqual(
      expect.arrayContaining([
        { color: "white", role: "king", square: "g1" },
        { color: "white", role: "rook", square: "f1" },
      ]),
    )
  })

  it("uses rook-square UCI for Chess960 castling", () => {
    const chess960StartingPosition: MatchStartingPosition = {
      chess960PositionId: requireChess960PositionId(518),
      variant: "chess960",
    }
    const position = requirePosition(
      chess960StartingPosition,
      "1k6/8/8/8/8/8/8/RK3R2 w FA - 0 1",
    )
    const castle = requireLegalMove(position, "b1f1")

    expect(castle).toMatchObject({
      from: "b1",
      id: "b1f1",
      kind: "castle",
      rookFrom: "f1",
      rookTo: "f1",
      san: "O-O",
      side: "king",
      to: "g1",
      uci: "b1f1",
    })
    expect(requireAppliedMove(position, "b1f1").after.pieces).toEqual(
      expect.arrayContaining([
        { color: "white", role: "king", square: "g1" },
        { color: "white", role: "rook", square: "f1" },
      ]),
    )
  })
})

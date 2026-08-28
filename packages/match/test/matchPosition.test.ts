import { describe, expect, it } from "vitest"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchStartingPosition,
} from "../src/matchPosition"

const standardStartingPosition: MatchStartingPosition = {
  chess960PositionId: null,
  variant: "standard",
}

describe("canonical match positions", () => {
  it("constructs the complete orthodox starting position", () => {
    const position = createInitialMatchPosition(standardStartingPosition)

    expect(position).toMatchObject({
      chess960PositionId: null,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      inCheck: false,
      status: { type: "playing" },
      turn: "white",
      variant: "standard",
    })
    expect(position.pieces).toHaveLength(32)
    expect(position.pieces).toContainEqual({
      color: "white",
      role: "king",
      square: "e1",
    })
  })

  it("rejects malformed FEN separately from illegal board positions", () => {
    expect(
      reconstructMatchPosition(standardStartingPosition, "not a FEN"),
    ).toEqual({
      error: { fen: "not a FEN", type: "MATCH.FEN_INVALID" },
      ok: false,
    })
    expect(
      reconstructMatchPosition(
        standardStartingPosition,
        "8/8/8/8/8/8/8/8 w - - 0 1",
      ),
    ).toEqual({
      error: {
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        type: "MATCH.POSITION_INVALID",
      },
      ok: false,
    })
  })

  it.each([
    {
      expectedStatus: { type: "checkmate", winner: "white" },
      fen: "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1",
      inCheck: true,
    },
    {
      expectedStatus: { type: "stalemate" },
      fen: "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1",
      inCheck: false,
    },
    {
      expectedStatus: { type: "insufficient-material" },
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      inCheck: false,
    },
  ])(
    "derives $expectedStatus.type from board truth",
    ({ expectedStatus, fen, inCheck }) => {
      const result = reconstructMatchPosition(standardStartingPosition, fen)

      expect(result).toMatchObject({
        ok: true,
        position: { inCheck, status: expectedStatus },
      })
    },
  )
})

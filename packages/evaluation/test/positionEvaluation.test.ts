import { describe, expect, it } from "vitest"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
} from "@mapachess/match/match-position"
import {
  normalizeStockfishPositionEvaluation,
  terminalPositionEvaluation,
} from "../src/positionEvaluation"

const standardStartingPosition = Object.freeze({
  chess960PositionId: null,
  variant: "standard",
} as const)

const requirePosition = (fen: string): MatchPosition => {
  const result = reconstructMatchPosition(standardStartingPosition, fen)
  if (!result.ok) throw new Error(`Expected a legal test position: ${fen}`)
  return result.position
}

describe("terminalPositionEvaluation", () => {
  it("does not synthesize an evaluation for a playable position", () => {
    expect(
      terminalPositionEvaluation(
        createInitialMatchPosition(standardStartingPosition),
      ),
    ).toBeUndefined()
  })

  it.each(["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "8/8/8/8/8/8/2k5/K7 w - - 0 1"])(
    "represents a terminal draw without an engine search",
    (fen) => {
      expect(terminalPositionEvaluation(requirePosition(fen))).toEqual({
        kind: "draw",
      })
    },
  )

  it.each([
    ["7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", "white"],
    ["8/8/8/8/8/5k2/6q1/7K w - - 0 1", "black"],
  ] as const)("represents checkmate as mate in zero for %s", (fen, winner) => {
    expect(terminalPositionEvaluation(requirePosition(fen))).toEqual({
      bound: "exact",
      kind: "mate",
      moves: 0,
      winner,
    })
  })
})

describe("normalizeStockfishPositionEvaluation", () => {
  it("preserves a White-to-move centipawn score and bound", () => {
    expect(
      normalizeStockfishPositionEvaluation("white", {
        bound: "lower",
        kind: "centipawns",
        value: 34,
      }),
    ).toEqual({
      bound: "lower",
      kind: "centipawns",
      whiteCentipawns: 34,
    })
  })

  it.each([
    ["exact", "exact"],
    ["lower", "upper"],
    ["upper", "lower"],
  ] as const)(
    "reverses a Black-to-move centipawn score and %s bound",
    (receivedBound, expectedBound) => {
      expect(
        normalizeStockfishPositionEvaluation("black", {
          bound: receivedBound,
          kind: "centipawns",
          value: 34,
        }),
      ).toEqual({
        bound: expectedBound,
        kind: "centipawns",
        whiteCentipawns: -34,
      })
    },
  )

  it.each([
    ["white", 3, "white", "lower", "lower"],
    ["white", -2, "black", "upper", "upper"],
    ["black", 4, "black", "lower", "upper"],
    ["black", -1, "white", "upper", "lower"],
  ] as const)(
    "normalizes %s-to-move mate %i as a %s win",
    (turn, value, winner, receivedBound, expectedBound) => {
      expect(
        normalizeStockfishPositionEvaluation(turn, {
          bound: receivedBound,
          kind: "mate",
          value,
        }),
      ).toEqual({
        bound: expectedBound,
        kind: "mate",
        moves: Math.abs(value),
        winner,
      })
    },
  )

  it("rejects a zero mate score outside a terminal position", () => {
    expect(() =>
      normalizeStockfishPositionEvaluation("white", {
        bound: "exact",
        kind: "mate",
        value: 0,
      }),
    ).toThrow("A non-terminal Stockfish mate score cannot be zero.")
  })
})

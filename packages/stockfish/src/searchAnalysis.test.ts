import { describe, expect, it } from "vitest"
import createStockfishSearchAnalysis from "./searchAnalysis"

describe("shared Stockfish analysis collection", () => {
  it("does not fabricate analysis for an empty search", () => {
    expect(createStockfishSearchAnalysis().complete()).toEqual({})
  })

  it("orders current variations while retaining the last exact primary result", () => {
    const analysis = createStockfishSearchAnalysis()
    analysis.record(3, ["g1f3"], {
      depth: 6,
      score: { bound: "exact", kind: "centipawns", value: 15 },
    })
    analysis.record(1, ["e2e4"], {
      depth: 6,
      nodes: 500,
      score: { bound: "exact", kind: "centipawns", value: 35 },
    })
    analysis.record(2, ["d2d4"], { selectiveDepth: 8 })
    analysis.record(1, ["c2c4"], {
      depth: 7,
      score: { bound: "lower", kind: "centipawns", value: 50 },
    })
    const result = analysis.complete()
    expect(result.principalVariations?.map(({ rank }) => rank)).toEqual([
      1, 2, 3,
    ])
    expect(result.principalVariations?.[0]?.moves).toEqual(["c2c4"])
    expect(result.latestExactPrincipalVariation).toEqual({
      rank: 1,
      moves: ["e2e4"],
      depth: 6,
      nodes: 500,
      score: { bound: "exact", kind: "centipawns", value: 35 },
    })
  })

  it("owns immutable move lists and does not share search state", () => {
    const first = createStockfishSearchAnalysis()
    const second = createStockfishSearchAnalysis()
    const moves = ["e2e4"]
    first.record(1, moves, {})
    moves[0] = "d2d4"
    expect(first.complete().principalVariations?.[0]?.moves).toEqual(["e2e4"])
    expect(second.complete()).toEqual({})
  })
})

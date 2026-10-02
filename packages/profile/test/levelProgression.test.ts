import { describe, expect, it } from "vitest"
import levelProgressionSpans, {
  easeOutQuad,
  levelProgressionTiming,
} from "../src/levelProgression.js"

describe("distance-proportional Level progression", () => {
  it("applies the exact monotonic quadratic without overshoot", () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(easeOutQuad)).toEqual([
      0, 0.4375, 0.75, 0.9375, 1,
    ])
  })

  it("allocates the 3.7-second minimum by traversed fractions, not segment count", () => {
    const spans = [...levelProgressionSpans(1, 9)]
    expect(levelProgressionTiming(1, 9)).toEqual({
      distance: 4,
      durationMs: 3700,
    })
    expect(spans.map((span) => span.durationMs)).toEqual([
      462.5, 925, 925, 925, 462.5,
    ])
    expect(spans.map(({ level }) => level)).toEqual([1, 2, 3, 4, 5])
    expect(spans[0]).toMatchObject({ fromFraction: 0.5, toFraction: 1 })
    expect(spans[4]).toMatchObject({ fromFraction: 0, toFraction: 0.5 })
  })

  it("uses 900 milliseconds per full bar for longer traversal", () => {
    const spans = [...levelProgressionSpans(4, 12)]
    expect(levelProgressionTiming(4, 12)).toEqual({
      distance: 4.5,
      durationMs: 4050,
    })
    expect(spans.map(({ durationMs }) => durationMs)).toEqual([
      900, 900, 900, 900, 450,
    ])
    expect(spans.reduce((sum, span) => sum + span.durationMs, 0)).toBe(4050)
  })

  it("uses the same spans in reverse for truthful decreases", () => {
    const ascending = [...levelProgressionSpans(1, 9)]
    const descending = [...levelProgressionSpans(9, 1)]
    expect(levelProgressionTiming(9, 1)).toEqual(levelProgressionTiming(1, 9))
    expect(descending).toEqual(
      ascending.reverse().map((span) => ({
        ...span,
        fromXp: span.toXp,
        toXp: span.fromXp,
        fromFraction: span.toFraction,
        toFraction: span.fromFraction,
      })),
    )
    expect([...levelProgressionSpans(8, 0)].map(({ level }) => level)).toEqual([
      4, 3, 2, 1,
    ])
  })

  it("neither repeats a boundary nor invents a zero-distance presentation", () => {
    expect([...levelProgressionSpans(0, 4)]).toHaveLength(2)
    expect([...levelProgressionSpans(4, 0)]).toHaveLength(2)
    expect([...levelProgressionSpans(4, 4)]).toEqual([])
    expect(levelProgressionTiming(4, 4)).toEqual({ distance: 0, durationMs: 0 })
    expect(() => levelProgressionTiming(-1, 4)).toThrow(TypeError)
    expect(() => levelProgressionTiming(4, 4.5)).toThrow(TypeError)
  })
})

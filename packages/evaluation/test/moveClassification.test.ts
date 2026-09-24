import { describe, expect, it } from "vitest"
import type { MatchColor } from "@mapachess/match/match-position"
import classifyMove, {
  classifyOutcomeChange,
  moverOutcomeEstimate,
  type MoveClassificationInput,
} from "../src/moveClassification.js"
import type { PositionEvaluation } from "../src/positionEvaluation.js"

const cp = (whiteCentipawns: number): PositionEvaluation => ({
  kind: "centipawns",
  bound: "exact",
  whiteCentipawns,
})
const mate = (
  moves: number,
  winner: MatchColor = "white",
): PositionEvaluation => ({
  kind: "mate",
  bound: "exact",
  moves,
  winner,
})
const classify = (input: Partial<MoveClassificationInput>) =>
  classifyMove({
    before: cp(0),
    after: cp(0),
    mover: "white",
    engineRecommended: false,
    ...input,
  })

describe("approved outcome thresholds", () => {
  it.each([
    [-20, "blunder"],
    [-19.999, "mistake"],
    [-10, "mistake"],
    [-9.999, "inaccuracy"],
    [-5, "inaccuracy"],
    [-4.999, "good"],
    [0, "good"],
    [9.999, "good"],
    [10, "genius"],
    [19.999, "genius"],
    [20, "brilliant"],
  ] as const)("classifies a %s point change as %s", (change, grade) => {
    expect(classifyOutcomeChange(change, false)).toBe(grade)
    expect(classifyOutcomeChange(change, true)).toBe(
      grade === "good" ? "best" : grade,
    )
  })

  it("normalizes White-relative centipawns exactly once for each mover", () => {
    expect(moverOutcomeEstimate(cp(100), "white")).toBeCloseTo(59.102958)
    expect(moverOutcomeEstimate(cp(100), "black")).toBeCloseTo(40.897042)
    expect(classify({ after: cp(-300), mover: "black" })).toMatchObject({
      classification: { grade: "brilliant" },
    })
    expect(classify({ after: cp(-300) })).toMatchObject({
      classification: { grade: "blunder" },
    })
  })
})

describe("approved mate transitions", () => {
  it.each(["white", "black"] as const)(
    "normalizes the countdown for %s",
    (mover) => {
      for (const [moves, grade] of [
        [2, "brilliant"],
        [3, "genius"],
        [4, "best"],
        [5, "good"],
        [6, "inaccuracy"],
        [7, "mistake"],
        [8, "mistake"],
      ] as const) {
        expect(
          classify({
            before: mate(5, mover),
            after: mate(moves, mover),
            mover,
            engineRecommended: true,
          }),
        ).toMatchObject({ classification: { grade } })
      }
    },
  )
  it("treats mate in one followed by checkmate as on schedule", () => {
    expect(classify({ before: mate(1), after: mate(0) })).toMatchObject({
      classification: { grade: "good" },
    })
  })
  it("grades disappearing mate from the existing completed search", () => {
    expect(classify({ before: mate(8), after: cp(1300) })).toMatchObject({
      status: "classified",
      classification: { grade: "inaccuracy", reason: "Lost forced mate" },
    })
  })
  it.each([
    [1300, "inaccuracy"],
    [500, "mistake"],
    [0, "blunder"],
  ] as const)("applies the lost-mate floor at %s cp", (score, grade) => {
    expect(
      classify({
        before: mate(8),
        after: cp(score),
      }),
    ).toMatchObject({
      classification: {
        grade,
        reason: "Lost forced mate",
        policyId: "mapachess-gdd-3.1",
      },
    })
  })
  it("does not reward delaying the opponent's forced mate", () => {
    expect(
      classify({ before: mate(2, "black"), after: mate(7, "black") }),
    ).toMatchObject({ classification: { grade: "good" } })
  })
  it("uses endpoints for creating, escaping, or allowing mate", () => {
    expect(classify({ after: mate(4) })).toMatchObject({
      classification: { grade: "brilliant" },
    })
    expect(classify({ before: mate(4, "black"), after: cp(0) })).toMatchObject({
      classification: { grade: "brilliant" },
    })
    expect(classify({ after: mate(4, "black") })).toMatchObject({
      classification: { grade: "blunder" },
    })
  })
  it("requires exact evaluations rather than treating bounds as scores", () => {
    for (const bound of ["lower", "upper"] as const) {
      const bounded: PositionEvaluation = {
        kind: "centipawns",
        whiteCentipawns: 300,
        bound,
      }
      expect(classify({ before: bounded })).toEqual({
        status: "verification-required",
        reason: "bounded-evaluation",
      })
      expect(classify({ after: bounded })).toEqual({
        status: "verification-required",
        reason: "bounded-evaluation",
      })
    }
  })
  it("keeps actual draws at the midpoint", () => {
    expect(moverOutcomeEstimate({ kind: "draw" }, "black")).toBe(50)
  })
})

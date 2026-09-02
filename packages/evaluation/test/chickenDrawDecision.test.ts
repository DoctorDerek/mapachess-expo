import { describe, expect, it } from "vitest"
import decideChickenDrawOffer, {
  PROVISIONAL_CHICKEN_DRAW_ACCEPTANCE_CENTIPAWNS,
} from "../src/chickenDrawDecision.js"
import type { PositionEvaluation } from "../src/positionEvaluation.js"
import type { PositionEvaluationResult } from "../src/positionEvaluator.js"

const CURRENT_FEN = "current-position-fen"

const result = (
  evaluation: PositionEvaluation,
  positionFen = CURRENT_FEN,
): PositionEvaluationResult =>
  Object.freeze({
    evaluation,
    positionFen,
    requestId: "evaluation/current-position",
  })

const decide = (
  evaluation: PositionEvaluation,
  playerColor: "black" | "white" = "white",
) =>
  decideChickenDrawOffer({
    evaluationResult: result(evaluation),
    playerColor,
    positionFen: CURRENT_FEN,
  })

describe("provisional Chicken draw decisions", () => {
  it("requires an accepted evaluation for the exact current FEN", () => {
    expect(
      decideChickenDrawOffer({
        evaluationResult: null,
        playerColor: "white",
        positionFen: CURRENT_FEN,
      }),
    ).toBeNull()
    expect(
      decideChickenDrawOffer({
        evaluationResult: result({ kind: "draw" }, "stale-position-fen"),
        playerColor: "white",
        positionFen: CURRENT_FEN,
      }),
    ).toBeNull()
  })

  it("accepts an exact draw from either player color", () => {
    expect(decide({ kind: "draw" }, "white")).toEqual({
      outcome: "accepted",
      positionFen: CURRENT_FEN,
    })
    expect(decide({ kind: "draw" }, "black")).toEqual({
      outcome: "accepted",
      positionFen: CURRENT_FEN,
    })
  })

  it.each([
    ["white", -100, "accepted"],
    ["white", -101, "rejected"],
    ["white", 400, "accepted"],
    ["black", 100, "accepted"],
    ["black", 101, "rejected"],
    ["black", -400, "accepted"],
  ] as const)(
    "uses the one-pawn Chicken threshold for a %s player at %i white centipawns",
    (playerColor, whiteCentipawns, outcome) => {
      expect(
        decide(
          { bound: "exact", kind: "centipawns", whiteCentipawns },
          playerColor,
        ),
      ).toMatchObject({ outcome })
    },
  )

  it("publishes the approved provisional one-pawn threshold", () => {
    expect(PROVISIONAL_CHICKEN_DRAW_ACCEPTANCE_CENTIPAWNS).toBe(100)
  })

  it("accepts only an exact forced mate favoring the player", () => {
    expect(
      decide({ bound: "exact", kind: "mate", moves: 3, winner: "white" }),
    ).toMatchObject({ outcome: "accepted" })
    expect(
      decide({ bound: "exact", kind: "mate", moves: 3, winner: "black" }),
    ).toMatchObject({ outcome: "rejected" })
    expect(
      decide({ bound: "lower", kind: "mate", moves: 3, winner: "white" }),
    ).toMatchObject({ outcome: "rejected" })
  })

  it.each([
    ["white", "lower", -100, "accepted"],
    ["white", "lower", -101, "rejected"],
    ["white", "upper", 500, "rejected"],
    ["black", "upper", 100, "accepted"],
    ["black", "upper", 101, "rejected"],
    ["black", "lower", -500, "rejected"],
  ] as const)(
    "handles a %s player with a %s bound at %i conservatively",
    (playerColor, bound, whiteCentipawns, outcome) => {
      expect(
        decide({ bound, kind: "centipawns", whiteCentipawns }, playerColor),
      ).toMatchObject({ outcome })
    },
  )
})

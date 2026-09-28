import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import { WEB_CALIBRATED_LADDER } from "@mapachess/stockfish/web-opponent-policy"
import webLadderAcceptanceFixture from "../test/webLadderAcceptanceFixture"
import fingerprintOpponentPolicy from "./opponentPolicy"
import { createWebOpponentCalibrationPolicy } from "./webOpponentCandidatePlan"

describe("frozen 100–2300 initial web calibration baseline", () => {
  it.each(["standard", "chess960"] as const)(
    "pins every %s preset to the measured policy and reports its limits",
    (variant) => {
      const rows = webLadderAcceptanceFixture[variant]
      expect(rows).toHaveLength(STOCKFISH_OPPONENTS.length)
      expect(WEB_CALIBRATED_LADDER[variant]).toHaveLength(rows.length)
      let previousEstimate = Number.NEGATIVE_INFINITY
      let previousProbability = Number.POSITIVE_INFINITY
      let pointCloseTargets = 0
      const bootstrapRadii: number[] = []
      for (const [
        index,
        [probability, estimate, lower, upper, games, fingerprint],
      ] of rows.entries()) {
        const opponent = STOCKFISH_OPPONENTS[index]
        if (opponent === undefined)
          throw new Error("Measured ladder exceeds opponent catalog")
        expect(WEB_CALIBRATED_LADDER[variant][index]).toEqual({
          calibrationFingerprint: fingerprint,
          randomMoveProbabilityBasisPoints: probability,
        })
        if (Math.abs(estimate - opponent.storyTargetElo) <= 10)
          pointCloseTargets += 1
        expect(lower).toBeLessThan(estimate)
        expect(upper).toBeGreaterThan(estimate)
        expect(estimate).toBeGreaterThan(previousEstimate)
        expect(probability).toBeLessThan(previousProbability)
        expect(games).toBeGreaterThanOrEqual(160)
        bootstrapRadii.push(Math.max(estimate - lower, upper - estimate))
        expect(
          fingerprintOpponentPolicy(
            createWebOpponentCalibrationPolicy(
              variant,
              { kind: "full-strength" },
              probability,
            ),
          ),
        ).toBe(fingerprint)
        previousEstimate = estimate
        previousProbability = probability
      }
      expect(pointCloseTargets).toBe(variant === "standard" ? 21 : 23)
      expect(Math.min(...bootstrapRadii)).toBeCloseTo(
        variant === "standard" ? 31.0 : 38.1,
        1,
      )
      expect(Math.max(...bootstrapRadii)).toBeCloseTo(
        variant === "standard" ? 60.1 : 70.1,
        1,
      )
    },
  )
})

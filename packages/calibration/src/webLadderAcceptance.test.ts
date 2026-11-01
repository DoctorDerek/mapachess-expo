import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import {
  WEB_CALIBRATED_LADDER,
  WEB_CHALLENGE_PRESETS,
} from "@mapachess/stockfish/web-opponent-policy"
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

describe("November 1 calibrated web Challenge presets", () => {
  it.each([
    [
      "standard",
      "18f76dd27a42255390ee8aa8ef526819b362d0b2d528320eea6d89b68d1742f3",
    ],
    [
      "chess960",
      "cd0845cd31467829089124717b8995fc9899a7b69450cf6619c67e43a98d7817",
    ],
  ] as const)(
    "reproduces the signed-off %s grid and calibration identities",
    (variant, digest) => {
      const rows = WEB_CHALLENGE_PRESETS[variant]
      expect(rows.map((row) => row.targetElo)).toEqual(
        Array.from({ length: 91 }, (_, index) => 100 + 25 * index),
      )
      let previousProbability = Number.POSITIVE_INFINITY
      const records = rows.map(
        ({
          targetElo,
          randomMoveProbabilityBasisPoints,
          calibrationFingerprint,
        }) => {
          expect(
            fingerprintOpponentPolicy(
              createWebOpponentCalibrationPolicy(
                variant,
                { kind: "full-strength" },
                randomMoveProbabilityBasisPoints,
              ),
            ),
          ).toBe(calibrationFingerprint)
          expect(randomMoveProbabilityBasisPoints).toBeLessThan(
            previousProbability,
          )
          previousProbability = randomMoveProbabilityBasisPoints
          return [
            variant,
            targetElo,
            randomMoveProbabilityBasisPoints,
            calibrationFingerprint,
          ].join("|")
        },
      )
      expect(
        createHash("sha256").update(records.join("\n")).digest("hex"),
      ).toBe(digest)
    },
  )
})

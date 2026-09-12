import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import { WEB_LADDER_RANDOM_BASIS_POINTS } from "@mapachess/stockfish/web-opponent-policy"
import webLadderAcceptanceFixture from "../test/webLadderAcceptanceFixture"
import fingerprintOpponentPolicy from "./opponentPolicy"
import { createWebOpponentCalibrationPolicy } from "./webOpponentCandidatePlan"

describe("accepted 100–2300 web engine-pool estimates", () => {
  it.each(["standard", "chess960"] as const)(
    "keeps every %s preset within the approved measured tolerances",
    (variant) => {
      const rows = webLadderAcceptanceFixture[variant]
      expect(rows).toHaveLength(STOCKFISH_OPPONENTS.length)
      expect(WEB_LADDER_RANDOM_BASIS_POINTS[variant]).toEqual(
        rows.map(([probability]) => probability),
      )
      let previousEstimate = Number.NEGATIVE_INFINITY
      for (const [
        index,
        [probability, estimate, lower, upper, games, fingerprint],
      ] of rows.entries()) {
        const opponent = STOCKFISH_OPPONENTS[index]
        if (opponent === undefined)
          throw new Error("Measured ladder exceeds opponent catalog")
        expect(
          Math.abs(estimate - opponent.storyTargetElo),
        ).toBeLessThanOrEqual(50)
        expect(
          Math.max(estimate - lower, upper - estimate),
        ).toBeLessThanOrEqual(100)
        expect(lower).toBeLessThan(estimate)
        expect(upper).toBeGreaterThan(estimate)
        expect(estimate).toBeGreaterThan(previousEstimate)
        expect(games).toBeGreaterThanOrEqual(40)
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
      }
    },
  )
})

import { describe, expect, it } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import type { BayesEloRating } from "./bayesEloRatingEvidence"
import type { CalibrationSmokeEvidenceSummary } from "./calibrationSmokeSummary"
import standardChickenCandidatePlan, {
  STANDARD_CHICKEN_MAX_PLIES,
  STANDARD_CHICKEN_POLICY_CATALOG,
  type StandardChickenPolicyId,
} from "./standardChickenCandidatePlan"
import createStandardChickenShortlist from "./standardChickenShortlist"

const COMPLETE_ESTIMATES: Readonly<Record<StandardChickenPolicyId, number>> = {
  "uci-elo-1320": 1320,
  "uci-elo-1600": 1590,
  "random-05000": 600,
  "random-06500": 300,
  "random-08000": 120,
  "random-09000": 50,
  "random-10000": -20,
}

function completeSummary(): CalibrationSmokeEvidenceSummary {
  const edgeIds = [
    ...new Set(standardChickenCandidatePlan.games.map(({ edgeId }) => edgeId)),
  ].sort()
  const fingerprints = standardChickenCandidatePlan.policies.map(
    ({ fingerprint }) => fingerprint,
  )

  return {
    planId: standardChickenCandidatePlan.planId,
    variant: "standard",
    maxPlies: STANDARD_CHICKEN_MAX_PLIES,
    scheduledGameCount: 240,
    storedGameCount: 240,
    completedGameCount: 240,
    unterminatedGameCount: 0,
    scoredPairCount: 120,
    policyScores: fingerprints.map((policyFingerprint) => ({
      policyFingerprint,
      scoredGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scoreHalfPoints: 0,
    })),
    edges: edgeIds.map((edgeId) => ({
      edgeId,
      scheduledGameCount: 40,
      storedGameCount: 40,
      completedGameCount: 40,
      unterminatedGameCount: 0,
      scheduledPairCount: 20,
      scoredPairCount: 20,
      incompletePairCount: 0,
    })),
    connectivity: { isConnected: true, components: [fingerprints] },
  }
}

function ratings(
  estimates: Readonly<
    Record<StandardChickenPolicyId, number>
  > = COMPLETE_ESTIMATES,
): readonly BayesEloRating[] {
  return STANDARD_CHICKEN_POLICY_CATALOG.map((policy, index) => {
    const estimateElo = estimates[policy.id]
    return {
      rank: index + 1,
      alias: `P${String(index + 1).padStart(3, "0")}`,
      policyFingerprint: policy.policyFingerprint,
      estimateElo,
      confidence95: {
        lowerElo: estimateElo - 50,
        upperElo: estimateElo + 60,
      },
      games: 40,
      scorePercent: 50,
      averageOpponentElo: estimateElo,
      drawPercent: 25,
    }
  })
}

describe("Standard Chicken shortlist", () => {
  it.each([
    {
      problem: "plan",
      change: { planId: standardPlanFixture().planId },
      reason: "plan-mismatch",
    },
    {
      problem: "execution bound",
      change: { maxPlies: STANDARD_CHICKEN_MAX_PLIES - 1 },
      reason: "execution-bound-mismatch",
    },
    {
      problem: "scheduled count",
      change: { scheduledGameCount: 239 },
      reason: "incomplete-evidence",
    },
    {
      problem: "stored count",
      change: { storedGameCount: 239 },
      reason: "incomplete-evidence",
    },
    {
      problem: "completed count",
      change: { completedGameCount: 239 },
      reason: "incomplete-evidence",
    },
    {
      problem: "unterminated game",
      change: { unterminatedGameCount: 1 },
      reason: "incomplete-evidence",
    },
    {
      problem: "scored pair count",
      change: { scoredPairCount: 119 },
      reason: "incomplete-evidence",
    },
  ])(
    "withholds a shortlist for a mismatched $problem even when all other evidence is complete",
    ({ change, reason }) => {
      expect(
        createStandardChickenShortlist({
          summary: { ...completeSummary(), ...change },
          ratings: ratings(),
        }),
      ).toMatchObject({
        status: "no-justified-shortlist",
        reasons: [reason],
        rankedCandidates: [],
        anchor: null,
      })
    },
  )

  it("rejects duplicate/missing ratings and a shifted calibration anchor", () => {
    const complete = ratings()
    const first = complete[0]
    if (first === undefined)
      throw new Error("The catalog must contain a rated anchor.")
    for (const invalid of [complete.slice(1), [...complete, first]])
      expect(
        createStandardChickenShortlist({
          summary: completeSummary(),
          ratings: invalid,
        }).reasons,
      ).toEqual(["missing-policy-ratings"])
    expect(
      createStandardChickenShortlist({
        summary: completeSummary(),
        ratings: ratings({ ...COMPLETE_ESTIMATES, "uci-elo-1320": 1321 }),
      }).reasons,
    ).toEqual(["anchor-offset-mismatch"])
  })

  it("does not nominate a weaker endpoint when every candidate is below the target", () => {
    const report = createStandardChickenShortlist({
      summary: completeSummary(),
      ratings: ratings({
        ...COMPLETE_ESTIMATES,
        "random-05000": 90,
        "random-06500": 80,
        "random-08000": 70,
        "random-09000": 60,
        "random-10000": 50,
      }),
    })
    expect(report.reasons).toEqual(["target-not-bracketed"])
    expect(report.bracket).toBeNull()
  })

  it("uses the declared probability tie-breaker rather than input order for equidistant estimates", () => {
    const report = createStandardChickenShortlist({
      summary: completeSummary(),
      ratings: [
        ...ratings({
          ...COMPLETE_ESTIMATES,
          "random-05000": 100,
          "random-06500": 100,
        }),
      ].reverse(),
    })
    expect(report.rankedCandidates.slice(0, 2).map(({ id }) => id)).toEqual([
      "random-05000",
      "random-06500",
    ])
  })
  it("ranks the five modified policies without nominating one", () => {
    const report = createStandardChickenShortlist({
      summary: completeSummary(),
      ratings: ratings(),
    })

    expect(report).toMatchObject({
      status: "evidence-ranked-shortlist",
      reasons: [],
      targetElo: 100,
      anchor: { declaredElo: 1320, observedElo: 1320 },
      bridgeValidation: {
        declaredElo: 1600,
        observedElo: 1590,
        observedDeltaElo: -10,
      },
      bracket: {
        atOrBelowTarget: { id: "random-09000", estimateElo: 50 },
        atOrAboveTarget: { id: "random-08000", estimateElo: 120 },
      },
    })
    expect(report.rankedCandidates.map(({ id }) => id)).toEqual([
      "random-08000",
      "random-09000",
      "random-10000",
      "random-06500",
      "random-05000",
    ])
    expect(report).not.toHaveProperty("winner")
    expect(report).not.toHaveProperty("recommendedPolicy")
  })

  it("withholds the shortlist when evidence is incomplete or disconnected", () => {
    const complete = completeSummary()
    const incomplete: CalibrationSmokeEvidenceSummary = {
      ...complete,
      storedGameCount: 238,
      completedGameCount: 238,
      scoredPairCount: 119,
      edges: complete.edges.map((edge, index) =>
        index === 0
          ? {
              ...edge,
              storedGameCount: 38,
              completedGameCount: 38,
              scoredPairCount: 19,
              incompletePairCount: 1,
            }
          : edge,
      ),
      connectivity: {
        isConnected: false,
        components: complete.connectivity.components,
      },
    }

    expect(
      createStandardChickenShortlist({
        summary: incomplete,
        ratings: ratings(),
      }),
    ).toMatchObject({
      status: "no-justified-shortlist",
      reasons: ["incomplete-evidence", "disconnected-evidence"],
      rankedCandidates: [],
      bracket: null,
    })
  })

  it("reports an absent 100-Elo bracket without choosing an endpoint", () => {
    const aboveTarget = {
      ...COMPLETE_ESTIMATES,
      "random-08000": 220,
      "random-09000": 180,
      "random-10000": 140,
    }
    const report = createStandardChickenShortlist({
      summary: completeSummary(),
      ratings: ratings(aboveTarget),
    })

    expect(report).toMatchObject({
      status: "no-justified-shortlist",
      reasons: ["target-not-bracketed"],
      bracket: null,
    })
    expect(report.rankedCandidates).toHaveLength(5)
  })
})

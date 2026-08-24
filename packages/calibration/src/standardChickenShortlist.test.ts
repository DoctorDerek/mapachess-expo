import { describe, expect, it } from "vitest"
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

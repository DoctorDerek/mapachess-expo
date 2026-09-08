import { describe, expect, it } from "vitest"
import { OPPONENT_POSITION_SEED_DERIVATION_VERSION } from "@mapachess/stockfish/opponent-move-selection"
import { indexCalibrationPolicies } from "./calibrationPolicyRegistry"
import { CALIBRATION_CANONICAL_LEGAL_MOVE_GENERATOR_VERSION } from "./opponentPolicy"
import createWebOpponentCandidatePlan from "./webOpponentCandidatePlan"

describe("bounded web opponent calibration plans", () => {
  it("preserves the identities of both completed original experiments", () => {
    expect(createWebOpponentCandidatePlan("standard").plan.planId).toBe(
      "sha256:02b2601da44d7205cb67dfee9a135fd7c22ba298ffe8c32b162702739997ff69",
    )
    expect(createWebOpponentCandidatePlan("chess960").plan.planId).toBe(
      "sha256:78033019989c058e2b3cfdecd225f5d2c093aa46930aa6ae01ded20a0ab017bf",
    )
  })

  it.each(["standard", "chess960"] as const)(
    "retains reproducible paired conditions for %s",
    (variant) => {
      const experiment = createWebOpponentCandidatePlan(variant)
      const { plan } = experiment
      expect(createWebOpponentCandidatePlan(variant)).toEqual(experiment)
      expect(plan.games).toHaveLength(200)
      expect(plan.policies).toHaveLength(6)
      expect(indexCalibrationPolicies(plan.policies).size).toBe(6)
      expect(new Set(plan.games.map((game) => game.openingId)).size).toBe(
        variant === "standard" ? 5 : 10,
      )
      const webPolicies = plan.policies.filter(
        ({ policy }) => "kind" in policy.engine,
      )
      expect(
        webPolicies
          .map(
            ({ policy }) =>
              policy.moveSelection.randomMoveProbabilityBasisPoints,
          )
          .sort((a, b) => a - b),
      ).toEqual([4000, 5000, 6500, 8000])
      for (const { policy } of plan.policies) {
        expect(policy.variant).toBe(variant)
        expect(policy.search.nodeLimit).toBe(10000)
        expect(policy.moveSelection.legalMoveGeneratorVersion).toBe(
          CALIBRATION_CANONICAL_LEGAL_MOVE_GENERATOR_VERSION,
        )
        expect(policy.randomness.seedDerivationVersion).toBe(
          OPPONENT_POSITION_SEED_DERIVATION_VERSION,
        )
      }
      for (const first of plan.games.filter((game) => game.gameInPair === 1)) {
        const second = plan.games.find(
          (game) => game.pairId === first.pairId && game.gameInPair === 2,
        )
        expect(second).toMatchObject({
          fen: first.fen,
          openingId: first.openingId,
          white: first.black,
          black: first.white,
        })
      }
      expect(
        plan.policies.some(
          ({ fingerprint }) =>
            fingerprint === experiment.anchor.policyFingerprint,
        ),
      ).toBe(true)
    },
  )

  it("never merges the two variants into one rating identity", () => {
    const standard = createWebOpponentCandidatePlan("standard")
    const chess960 = createWebOpponentCandidatePlan("chess960")
    expect(standard.plan.planId).not.toBe(chess960.plan.planId)
    expect(standard.anchor.policyFingerprint).not.toBe(
      chess960.anchor.policyFingerprint,
    )
  })
})

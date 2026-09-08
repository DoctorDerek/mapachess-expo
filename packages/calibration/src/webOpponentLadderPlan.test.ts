import { describe, expect, it } from "vitest"
import { indexCalibrationPolicies } from "./calibrationPolicyRegistry"
import createWebOpponentCandidatePlan from "./webOpponentCandidatePlan"
import createWebOpponentLadderPlan, {
  createWebOpponentWeakEndPlan,
  WEB_OPPONENT_LADDER_CANDIDATES,
} from "./webOpponentLadderPlan"

describe("bounded direct web ladder refinement", () => {
  it.each(["standard", "chess960"] as const)(
    "records the conditional prior for weak-end nomination in %s",
    (variant) => {
      const experiment = createWebOpponentWeakEndPlan(variant)
      const original = createWebOpponentCandidatePlan(variant)
      const { plan, anchor, anchorProvenance } = experiment
      expect(plan.games).toHaveLength(40)
      expect(plan.policies).toHaveLength(2)
      expect(plan.policies.every(({ policy }) => "kind" in policy.engine)).toBe(
        true,
      )
      expect(
        plan.policies.find(
          ({ fingerprint }) => fingerprint === anchor.policyFingerprint,
        )?.policy.moveSelection.randomMoveProbabilityBasisPoints,
      ).toBe(8000)
      expect(anchorProvenance).toMatchObject({
        kind: "conditional-prior-estimate",
        nominationOnly: true,
        priorCompletedGameCount: 200,
        priorEvidence: {
          planId: original.plan.planId,
          estimate: anchor.elo,
        },
      })
      expect(
        anchorProvenance.priorEvidence.confidenceInterval95.lower,
      ).toBeLessThan(anchor.elo)
      expect(
        anchorProvenance.priorEvidence.confidenceInterval95.upper,
      ).toBeGreaterThan(anchor.elo)
    },
  )

  it.each(["standard", "chess960"] as const)(
    "connects ten candidates directly to the original reference in %s",
    (variant) => {
      const { plan, anchor } = createWebOpponentLadderPlan(variant)
      expect(createWebOpponentLadderPlan(variant).plan).toEqual(plan)
      expect(plan.games).toHaveLength(400)
      expect(indexCalibrationPolicies(plan.policies).size).toBe(11)
      expect(anchor).toEqual(createWebOpponentCandidatePlan(variant).anchor)
      const probabilities = plan.policies
        .filter(({ policy }) => "kind" in policy.engine)
        .map(
          ({ policy }) => policy.moveSelection.randomMoveProbabilityBasisPoints,
        )
        .sort((left, right) => right - left)
      expect(probabilities).toEqual(WEB_OPPONENT_LADDER_CANDIDATES[variant])
      expect(new Set(probabilities).size).toBe(10)

      const edgeIds = new Set(plan.games.map((game) => game.edgeId))
      expect(edgeIds.size).toBe(10)
      for (const edgeId of edgeIds) {
        expect(
          plan.games.filter((game) => game.edgeId === edgeId),
        ).toHaveLength(40)
      }
      const openings = new Set(plan.games.map((game) => game.openingId))
      expect(openings.size).toBe(variant === "standard" ? 5 : 10)
      for (const first of plan.games.filter((game) => game.gameInPair === 1)) {
        expect(
          plan.games.find(
            (game) => game.pairId === first.pairId && game.gameInPair === 2,
          ),
        ).toMatchObject({
          variant,
          fen: first.fen,
          openingId: first.openingId,
          white: first.black,
          black: first.white,
        })
      }
    },
  )

  it("keeps all refinement evidence separate within the 880-game ceiling", () => {
    const plans = [
      createWebOpponentWeakEndPlan("standard").plan,
      createWebOpponentWeakEndPlan("chess960").plan,
      createWebOpponentLadderPlan("standard").plan,
      createWebOpponentLadderPlan("chess960").plan,
    ]
    expect(new Set(plans.map((plan) => plan.planId)).size).toBe(4)
    expect(plans.map((plan) => plan.planId)).toEqual([
      "sha256:068eef0fbdf445576730958a9baec081fca5499559a886fdee6749e00392a3d8",
      "sha256:89cc8ac77aedfe9af5750f106c569cb74be7f30156249647d8ea7382cd64f9d6",
      "sha256:909604ed0df6f22bfc8ef555bc5b4f4915933e7960c011cc3332f5781294bdf9",
      "sha256:01ec97323770c51e70f455128bf73e284e32436a8cdaf5ff9aa5fc261e3b05d4",
    ])
    expect(plans.reduce((total, plan) => total + plan.games.length, 0)).toBe(
      880,
    )
    expect(
      new Set(plans.flatMap((plan) => plan.games.map((game) => game.gameId)))
        .size,
    ).toBe(880)
  })
})

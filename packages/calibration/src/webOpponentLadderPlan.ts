import { PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS } from "@mapachess/stockfish/web-opponent-policy"
import type { RunBayesEloInput } from "./bayesEloRunner.js"
import type { CalibrationPlan } from "./calibrationPlan.js"
import fingerprintOpponentPolicy, {
  type CalibrationVariant,
} from "./opponentPolicy.js"
import {
  createWebOpponentCalibrationPolicy,
  createWebOpponentComparisonPlan,
  createWebOpponentReferenceAnchor,
  WEB_OPPONENT_REFERENCE_ELO,
} from "./webOpponentCandidatePlan.js"

const WEAK_END_PROBABILITIES = [9_000, 8_000] as const

export const WEB_OPPONENT_LADDER_CANDIDATES =
  PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS

const PRIOR_WEB_RANDOM_80_EVIDENCE = {
  standard: {
    planId:
      "sha256:02b2601da44d7205cb67dfee9a135fd7c22ba298ffe8c32b162702739997ff69",
    completedPairsPgnSha256:
      "51e16e4e4fac93e5f005d33ed20d512e818028feb5a4ebae943bd6600c292103",
    estimate: 219,
    confidenceInterval95: { lower: 128, upper: 300 },
  },
  chess960: {
    planId:
      "sha256:78033019989c058e2b3cfdecd225f5d2c093aa46930aa6ae01ded20a0ab017bf",
    completedPairsPgnSha256:
      "55746dd6b937f10b4e35a1085bd60c3373a215d8de302d752e8c88d6d5a9e26b",
    estimate: 321,
    confidenceInterval95: { lower: 234, upper: 398 },
  },
} as const

export function createWebOpponentWeakEndPlan(
  variant: CalibrationVariant,
): Readonly<{
  plan: CalibrationPlan
  anchor: RunBayesEloInput["anchor"]
  anchorProvenance: Readonly<{
    kind: "conditional-prior-estimate"
    nominationOnly: true
    priorCompletedGameCount: 200
    priorEvidence: (typeof PRIOR_WEB_RANDOM_80_EVIDENCE)[CalibrationVariant]
  }>
}> {
  const priorEvidence = PRIOR_WEB_RANDOM_80_EVIDENCE[variant]
  return {
    plan: createWebOpponentComparisonPlan(variant, WEAK_END_PROBABILITIES, []),
    anchor: {
      elo: priorEvidence.estimate,
      policyFingerprint: fingerprintOpponentPolicy(
        createWebOpponentCalibrationPolicy(
          variant,
          { kind: "full-strength" },
          WEAK_END_PROBABILITIES[1],
        ),
      ),
    },
    anchorProvenance: {
      kind: "conditional-prior-estimate",
      nominationOnly: true,
      priorCompletedGameCount: 200,
      priorEvidence,
    },
  }
}

export default function createWebOpponentLadderPlan(
  variant: CalibrationVariant,
): Readonly<{ plan: CalibrationPlan; anchor: RunBayesEloInput["anchor"] }> {
  return {
    plan: createWebOpponentComparisonPlan(
      variant,
      WEB_OPPONENT_LADDER_CANDIDATES[variant],
      [WEB_OPPONENT_REFERENCE_ELO],
    ),
    anchor: createWebOpponentReferenceAnchor(variant),
  }
}

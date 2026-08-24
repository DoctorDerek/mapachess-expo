import type { BayesEloRating } from "./bayesEloRatingEvidence.js"
import type { CalibrationSmokeEvidenceSummary } from "./calibrationSmokeSummary.js"
import type { OpponentPolicyFingerprint } from "./opponentPolicy.js"
import standardChickenCandidatePlan, {
  STANDARD_CHICKEN_MAX_PLIES,
  STANDARD_CHICKEN_POLICY_CATALOG,
  STANDARD_CHICKEN_TARGET_ELO,
  type StandardChickenPolicyId,
} from "./standardChickenCandidatePlan.js"

export type StandardChickenShortlistReason =
  | "anchor-offset-mismatch"
  | "disconnected-evidence"
  | "execution-bound-mismatch"
  | "incomplete-evidence"
  | "missing-policy-ratings"
  | "plan-mismatch"
  | "target-not-bracketed"

export type StandardChickenRankedCandidate = Readonly<{
  confidence95: BayesEloRating["confidence95"]
  distanceFromTargetElo: number
  drawPercent: number
  estimateElo: number
  games: number
  id: StandardChickenPolicyId
  policyFingerprint: OpponentPolicyFingerprint
  randomMoveProbabilityBasisPoints: number
  scorePercent: number
}>

export type StandardChickenShortlistReport = Readonly<{
  status: "evidence-ranked-shortlist" | "no-justified-shortlist"
  anchor: Readonly<{
    declaredElo: 1320
    observedElo: number
    policyFingerprint: OpponentPolicyFingerprint
  }> | null
  bracket: Readonly<{
    atOrAboveTarget: StandardChickenRankedCandidate
    atOrBelowTarget: StandardChickenRankedCandidate
  }> | null
  bridgeValidation: Readonly<{
    declaredElo: 1600
    observedDeltaElo: number
    observedElo: number
    policyFingerprint: OpponentPolicyFingerprint
  }> | null
  planId: typeof standardChickenCandidatePlan.planId
  rankedCandidates: readonly StandardChickenRankedCandidate[]
  reasons: readonly StandardChickenShortlistReason[]
  targetElo: typeof STANDARD_CHICKEN_TARGET_ELO
}>

export type CreateStandardChickenShortlistInput = Readonly<{
  ratings: readonly BayesEloRating[]
  summary: CalibrationSmokeEvidenceSummary
}>

function emptyReport(
  reasons: readonly StandardChickenShortlistReason[],
): StandardChickenShortlistReport {
  return {
    planId: standardChickenCandidatePlan.planId,
    targetElo: STANDARD_CHICKEN_TARGET_ELO,
    status: "no-justified-shortlist",
    reasons,
    anchor: null,
    bridgeValidation: null,
    rankedCandidates: [],
    bracket: null,
  }
}

function ratingByFingerprint(
  ratings: readonly BayesEloRating[],
): ReadonlyMap<OpponentPolicyFingerprint, BayesEloRating> | undefined {
  const indexed = new Map(
    ratings.map((rating) => [rating.policyFingerprint, rating]),
  )
  return indexed.size === ratings.length ? indexed : undefined
}

function scheduledEvidenceReasons(
  summary: CalibrationSmokeEvidenceSummary,
): StandardChickenShortlistReason[] {
  const reasons: StandardChickenShortlistReason[] = []
  if (summary.planId !== standardChickenCandidatePlan.planId) {
    reasons.push("plan-mismatch")
  }
  if (summary.maxPlies !== STANDARD_CHICKEN_MAX_PLIES) {
    reasons.push("execution-bound-mismatch")
  }
  if (
    summary.scheduledGameCount !== standardChickenCandidatePlan.games.length ||
    summary.storedGameCount !== standardChickenCandidatePlan.games.length ||
    summary.completedGameCount !== standardChickenCandidatePlan.games.length ||
    summary.unterminatedGameCount !== 0 ||
    summary.scoredPairCount * 2 !== standardChickenCandidatePlan.games.length ||
    summary.edges.some(({ incompletePairCount }) => incompletePairCount !== 0)
  ) {
    reasons.push("incomplete-evidence")
  }
  if (!summary.connectivity.isConnected) {
    reasons.push("disconnected-evidence")
  }

  return reasons
}

function requireCatalogRating(
  ratings: ReadonlyMap<OpponentPolicyFingerprint, BayesEloRating>,
  id: StandardChickenPolicyId,
): BayesEloRating | undefined {
  const policy = STANDARD_CHICKEN_POLICY_CATALOG.find(
    (record) => record.id === id,
  )
  return policy === undefined
    ? undefined
    : ratings.get(policy.policyFingerprint)
}

function rankedCandidates(
  ratings: ReadonlyMap<OpponentPolicyFingerprint, BayesEloRating>,
): readonly StandardChickenRankedCandidate[] | undefined {
  const candidates: StandardChickenRankedCandidate[] = []

  for (const policy of STANDARD_CHICKEN_POLICY_CATALOG) {
    if (policy.kind !== "random-candidate") continue
    const rating = ratings.get(policy.policyFingerprint)
    if (rating === undefined) return undefined

    candidates.push({
      id: policy.id,
      policyFingerprint: policy.policyFingerprint,
      randomMoveProbabilityBasisPoints: policy.randomMoveProbabilityBasisPoints,
      estimateElo: rating.estimateElo,
      confidence95: rating.confidence95,
      games: rating.games,
      scorePercent: rating.scorePercent,
      drawPercent: rating.drawPercent,
      distanceFromTargetElo: Math.abs(
        rating.estimateElo - STANDARD_CHICKEN_TARGET_ELO,
      ),
    })
  }

  return candidates.toSorted(
    (left, right) =>
      left.distanceFromTargetElo - right.distanceFromTargetElo ||
      left.randomMoveProbabilityBasisPoints -
        right.randomMoveProbabilityBasisPoints,
  )
}

export default function createStandardChickenShortlist(
  input: CreateStandardChickenShortlistInput,
): StandardChickenShortlistReport {
  const reasons = scheduledEvidenceReasons(input.summary)
  if (reasons.length > 0) return emptyReport(reasons)

  const ratings = ratingByFingerprint(input.ratings)
  if (
    ratings === undefined ||
    ratings.size !== STANDARD_CHICKEN_POLICY_CATALOG.length ||
    STANDARD_CHICKEN_POLICY_CATALOG.some(
      ({ policyFingerprint }) => !ratings.has(policyFingerprint),
    )
  ) {
    return emptyReport(["missing-policy-ratings"])
  }

  const anchorRating = requireCatalogRating(ratings, "uci-elo-1320")
  const validationRating = requireCatalogRating(ratings, "uci-elo-1600")
  const anchorPolicy = STANDARD_CHICKEN_POLICY_CATALOG.find(
    ({ id }) => id === "uci-elo-1320",
  )
  const validationPolicy = STANDARD_CHICKEN_POLICY_CATALOG.find(
    ({ id }) => id === "uci-elo-1600",
  )
  if (
    anchorRating === undefined ||
    validationRating === undefined ||
    anchorPolicy === undefined ||
    validationPolicy === undefined
  ) {
    return emptyReport(["missing-policy-ratings"])
  }
  if (anchorRating.estimateElo !== 1320) {
    return emptyReport(["anchor-offset-mismatch"])
  }

  const candidates = rankedCandidates(ratings)
  if (candidates === undefined) {
    return emptyReport(["missing-policy-ratings"])
  }
  const atOrBelowTarget = candidates
    .filter(({ estimateElo }) => estimateElo <= STANDARD_CHICKEN_TARGET_ELO)
    .toSorted((left, right) => right.estimateElo - left.estimateElo)[0]
  const atOrAboveTarget = candidates
    .filter(({ estimateElo }) => estimateElo >= STANDARD_CHICKEN_TARGET_ELO)
    .toSorted((left, right) => left.estimateElo - right.estimateElo)[0]
  const hasBracket =
    atOrBelowTarget !== undefined && atOrAboveTarget !== undefined

  return {
    planId: standardChickenCandidatePlan.planId,
    targetElo: STANDARD_CHICKEN_TARGET_ELO,
    status: hasBracket ? "evidence-ranked-shortlist" : "no-justified-shortlist",
    reasons: hasBracket ? [] : ["target-not-bracketed"],
    anchor: {
      declaredElo: 1320,
      observedElo: anchorRating.estimateElo,
      policyFingerprint: anchorPolicy.policyFingerprint,
    },
    bridgeValidation: {
      declaredElo: 1600,
      observedElo: validationRating.estimateElo,
      observedDeltaElo: validationRating.estimateElo - 1600,
      policyFingerprint: validationPolicy.policyFingerprint,
    },
    rankedCandidates: candidates,
    bracket: hasBracket
      ? {
          atOrBelowTarget,
          atOrAboveTarget,
        }
      : null,
  }
}

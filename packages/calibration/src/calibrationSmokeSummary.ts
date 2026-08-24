import {
  loadStoredCalibrationGame,
  type CalibrationCompletionMarker,
} from "./calibrationEvidenceStore.js"
import type {
  CalibrationGame,
  CalibrationGameId,
  CalibrationPlan,
} from "./calibrationPlan.js"
import listCalibrationPlanPairs from "./calibrationPlanPairs.js"
import type { OpponentPolicyFingerprint } from "./opponentPolicy.js"

export type SummarizeCalibrationSmokeEvidenceInput = Readonly<{
  maxPlies: number
  plan: CalibrationPlan
  rootDirectory: string
}>

export type CalibrationPolicyScoreSummary = Readonly<{
  draws: number
  losses: number
  policyFingerprint: OpponentPolicyFingerprint
  scoreHalfPoints: number
  scoredGames: number
  wins: number
}>

export type CalibrationEdgeEvidenceSummary = Readonly<{
  completedGameCount: number
  edgeId: string
  incompletePairCount: number
  scheduledGameCount: number
  scheduledPairCount: number
  scoredPairCount: number
  storedGameCount: number
  unterminatedGameCount: number
}>

export type CalibrationGraphConnectivitySummary = Readonly<{
  components: readonly (readonly OpponentPolicyFingerprint[])[]
  isConnected: boolean
}>

export type CalibrationSmokeEvidenceSummary = Readonly<{
  completedGameCount: number
  connectivity: CalibrationGraphConnectivitySummary
  edges: readonly CalibrationEdgeEvidenceSummary[]
  maxPlies: number
  planId: CalibrationPlan["planId"]
  policyScores: readonly CalibrationPolicyScoreSummary[]
  scheduledGameCount: number
  scoredPairCount: number
  storedGameCount: number
  unterminatedGameCount: number
  variant: "standard"
}>

type MutablePolicyScore = {
  draws: number
  losses: number
  policyFingerprint: OpponentPolicyFingerprint
  scoreHalfPoints: number
  scoredGames: number
  wins: number
}

type MutableEdgeSummary = {
  completedGameCount: number
  edgeId: string
  scheduledGameCount: number
  scoredPairCount: number
  storedGameCount: number
  unterminatedGameCount: number
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function compareText(left: string, right: string): number {
  return Number(left > right) - Number(left < right)
}

function indexPolicyScores(
  plan: CalibrationPlan,
): Map<OpponentPolicyFingerprint, MutablePolicyScore> {
  return new Map(
    plan.policies.map(({ fingerprint }) => [
      fingerprint,
      {
        policyFingerprint: fingerprint,
        scoredGames: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoreHalfPoints: 0,
      },
    ]),
  )
}

function indexEdgeSummaries(
  plan: CalibrationPlan,
): Map<string, MutableEdgeSummary> {
  const edges = new Map<string, MutableEdgeSummary>()

  for (const game of plan.games) {
    const existing = edges.get(game.edgeId)
    if (existing === undefined) {
      edges.set(game.edgeId, {
        edgeId: game.edgeId,
        scheduledGameCount: 1,
        storedGameCount: 0,
        completedGameCount: 0,
        unterminatedGameCount: 0,
        scoredPairCount: 0,
      })
    } else {
      existing.scheduledGameCount += 1
    }
  }

  return edges
}

function requireEdgeSummary(
  edges: Map<string, MutableEdgeSummary>,
  edgeId: string,
): MutableEdgeSummary {
  const edge = edges.get(edgeId)
  if (edge === undefined) {
    throw new Error(`Calibration edge summary is missing: ${edgeId}.`)
  }

  return edge
}

function requirePolicyScore(
  scores: Map<OpponentPolicyFingerprint, MutablePolicyScore>,
  fingerprint: OpponentPolicyFingerprint,
): MutablePolicyScore {
  const score = scores.get(fingerprint)
  if (score === undefined) {
    throw new Error(`Calibration policy score is missing: ${fingerprint}.`)
  }

  return score
}

function scoreGame(
  game: CalibrationGame,
  marker: CalibrationCompletionMarker,
  scores: Map<OpponentPolicyFingerprint, MutablePolicyScore>,
): void {
  const white = requirePolicyScore(scores, game.white.policyFingerprint)
  const black = requirePolicyScore(scores, game.black.policyFingerprint)
  white.scoredGames += 1
  black.scoredGames += 1

  if (marker.resultTag === "1-0") {
    white.wins += 1
    white.scoreHalfPoints += 2
    black.losses += 1
    return
  }
  if (marker.resultTag === "0-1") {
    black.wins += 1
    black.scoreHalfPoints += 2
    white.losses += 1
    return
  }
  if (marker.resultTag === "1/2-1/2") {
    white.draws += 1
    white.scoreHalfPoints += 1
    black.draws += 1
    black.scoreHalfPoints += 1
    return
  }

  throw new Error("A completed calibration game must have a scored result.")
}

function connectPolicies(
  adjacency: Map<OpponentPolicyFingerprint, Set<OpponentPolicyFingerprint>>,
  first: OpponentPolicyFingerprint,
  second: OpponentPolicyFingerprint,
): void {
  const firstNeighbors = adjacency.get(first)
  const secondNeighbors = adjacency.get(second)
  if (firstNeighbors === undefined || secondNeighbors === undefined) {
    throw new Error("Calibration connectivity is missing a scheduled policy.")
  }

  firstNeighbors.add(second)
  secondNeighbors.add(first)
}

function summarizeConnectivity(
  adjacency: Map<OpponentPolicyFingerprint, Set<OpponentPolicyFingerprint>>,
): CalibrationGraphConnectivitySummary {
  const visited = new Set<OpponentPolicyFingerprint>()
  const components: OpponentPolicyFingerprint[][] = []

  for (const fingerprint of [...adjacency.keys()].sort(compareText)) {
    if (visited.has(fingerprint)) continue
    const component: OpponentPolicyFingerprint[] = []
    const pending = [fingerprint]

    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined || visited.has(current)) continue
      visited.add(current)
      component.push(current)
      const neighbors = adjacency.get(current)
      if (neighbors === undefined) {
        throw new Error(`Calibration adjacency is missing: ${current}.`)
      }
      pending.push(...neighbors)
    }

    components.push(component.sort(compareText))
  }

  return {
    components,
    isConnected: components.length === 1,
  }
}

function finalizedEdges(
  edges: Map<string, MutableEdgeSummary>,
): readonly CalibrationEdgeEvidenceSummary[] {
  return [...edges.values()]
    .sort((left, right) => compareText(left.edgeId, right.edgeId))
    .map((edge) => {
      if (edge.scheduledGameCount % 2 !== 0) {
        throw new TypeError("Calibration edges must schedule paired games.")
      }
      const scheduledPairCount = edge.scheduledGameCount / 2
      return {
        ...edge,
        scheduledPairCount,
        incompletePairCount: scheduledPairCount - edge.scoredPairCount,
      }
    })
}

export default async function summarizeCalibrationSmokeEvidence(
  input: SummarizeCalibrationSmokeEvidenceInput,
): Promise<CalibrationSmokeEvidenceSummary> {
  assertPositiveSafeInteger(input.maxPlies, "maxPlies")
  if (input.plan.variant !== "standard") {
    throw new TypeError(
      "Smoke evidence summaries currently support Standard only.",
    )
  }

  const scores = indexPolicyScores(input.plan)
  const edges = indexEdgeSummaries(input.plan)
  const storedMarkers = new Map<
    CalibrationGameId,
    CalibrationCompletionMarker
  >()

  for (const game of input.plan.games) {
    const stored = await loadStoredCalibrationGame({
      rootDirectory: input.rootDirectory,
      plan: input.plan,
      game,
      maxPlies: input.maxPlies,
    })
    if (stored === undefined) continue

    storedMarkers.set(game.gameId, stored.marker)
    const edge = requireEdgeSummary(edges, game.edgeId)
    edge.storedGameCount += 1
    if (stored.marker.resultStatus === "completed") {
      edge.completedGameCount += 1
    } else {
      edge.unterminatedGameCount += 1
    }
  }

  const adjacency = new Map(
    input.plan.policies.map(({ fingerprint }) => [
      fingerprint,
      new Set<OpponentPolicyFingerprint>(),
    ]),
  )

  for (const [first, second] of listCalibrationPlanPairs(input.plan)) {
    const firstMarker = storedMarkers.get(first.gameId)
    const secondMarker = storedMarkers.get(second.gameId)
    if (
      firstMarker?.resultStatus !== "completed" ||
      secondMarker?.resultStatus !== "completed"
    ) {
      continue
    }

    scoreGame(first, firstMarker, scores)
    scoreGame(second, secondMarker, scores)
    requireEdgeSummary(edges, first.edgeId).scoredPairCount += 1
    connectPolicies(
      adjacency,
      first.white.policyFingerprint,
      first.black.policyFingerprint,
    )
  }

  const finalizedEdgeSummaries = finalizedEdges(edges)
  return {
    planId: input.plan.planId,
    variant: "standard",
    maxPlies: input.maxPlies,
    scheduledGameCount: input.plan.games.length,
    storedGameCount: finalizedEdgeSummaries.reduce(
      (total, edge) => total + edge.storedGameCount,
      0,
    ),
    completedGameCount: finalizedEdgeSummaries.reduce(
      (total, edge) => total + edge.completedGameCount,
      0,
    ),
    unterminatedGameCount: finalizedEdgeSummaries.reduce(
      (total, edge) => total + edge.unterminatedGameCount,
      0,
    ),
    scoredPairCount: finalizedEdgeSummaries.reduce(
      (total, edge) => total + edge.scoredPairCount,
      0,
    ),
    policyScores: [...scores.values()].sort((left, right) =>
      compareText(left.policyFingerprint, right.policyFingerprint),
    ),
    edges: finalizedEdgeSummaries,
    connectivity: summarizeConnectivity(adjacency),
  }
}

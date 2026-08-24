import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import provisionStockfish18, {
  type ProvisionedStockfish,
} from "@mapachess/stockfish/provision"
import { createProvisionedStockfishProcessAdapter } from "@mapachess/stockfish/uci-process-adapter"
import createBayesEloInput from "./bayesEloInput"
import provisionBayesElo, {
  type ProvisionedBayesElo,
} from "./bayesEloProvision"
import runBayesElo from "./bayesEloRunner"
import persistCalibrationGameEvidence from "./calibrationEvidenceStore"
import createCalibrationGameEvidence from "./calibrationGameEvidence"
import { executeCalibrationPair } from "./calibrationGameExecutor"
import listCalibrationPlanPairs, {
  type CalibrationPlanPair,
} from "./calibrationPlanPairs"
import summarizeCalibrationSmokeEvidence from "./calibrationSmokeSummary"
import standardChickenCandidatePlan, {
  STANDARD_CHICKEN_ANCHOR,
  STANDARD_CHICKEN_MAX_PLIES,
} from "./standardChickenCandidatePlan"
import createStandardChickenShortlist from "./standardChickenShortlist"

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..")
const EXPECTED_EDGE_IDS = [
  "random-05000-vs-random-06500",
  "random-06500-vs-random-08000",
  "random-08000-vs-random-09000",
  "random-09000-vs-random-10000",
  "uci-1320-vs-random-05000",
  "uci-1320-vs-uci-1600",
] as const

let provisionedBayesElo: ProvisionedBayesElo
let provisionedStockfish: ProvisionedStockfish

beforeAll(async () => {
  const [stockfish, bayesElo] = await Promise.all([
    provisionStockfish18(WORKSPACE_ROOT),
    provisionBayesElo(WORKSPACE_ROOT),
  ])
  provisionedStockfish = stockfish
  provisionedBayesElo = bayesElo
}, 30_000)

function firstScheduledPairPerEdge(): readonly CalibrationPlanPair[] {
  const pairsByEdge = Map.groupBy(
    listCalibrationPlanPairs(standardChickenCandidatePlan),
    ([first]) => first.edgeId,
  )

  return EXPECTED_EDGE_IDS.map((edgeId) => {
    const pair = pairsByEdge.get(edgeId)?.[0]
    if (pair === undefined) {
      throw new Error(`Standard Chicken edge has no scheduled pair: ${edgeId}.`)
    }

    return pair
  })
}

describe("Standard Chicken candidate integration", () => {
  it("creates real connected rating evidence without claiming a shortlist", async () => {
    const rootDirectory = await mkdtemp(
      join(tmpdir(), "mapachess-standard-chicken-candidate-"),
    )

    try {
      const pairs = firstScheduledPairPerEdge()
      expect(pairs).toHaveLength(6)

      for (const pair of pairs) {
        const result = await executeCalibrationPair({
          games: pair,
          policies: standardChickenCandidatePlan.policies,
          maxPlies: STANDARD_CHICKEN_MAX_PLIES,
          openEngine: ({ configuration }) =>
            createProvisionedStockfishProcessAdapter(
              provisionedStockfish,
              configuration,
            ),
        })

        for (const gameResult of result.games) {
          await persistCalibrationGameEvidence({
            rootDirectory,
            plan: standardChickenCandidatePlan,
            evidence: createCalibrationGameEvidence({
              plan: standardChickenCandidatePlan,
              maxPlies: STANDARD_CHICKEN_MAX_PLIES,
              result: gameResult,
            }),
          })
        }
      }

      const summary = await summarizeCalibrationSmokeEvidence({
        rootDirectory,
        plan: standardChickenCandidatePlan,
        maxPlies: STANDARD_CHICKEN_MAX_PLIES,
      })
      const input = await createBayesEloInput({
        rootDirectory,
        plan: standardChickenCandidatePlan,
        maxPlies: STANDARD_CHICKEN_MAX_PLIES,
      })
      const ratingEvidence = await runBayesElo({
        input,
        anchor: STANDARD_CHICKEN_ANCHOR,
        provisioned: provisionedBayesElo,
      })
      const shortlist = createStandardChickenShortlist({
        summary,
        ratings: ratingEvidence.ratings,
      })

      expect(summary).toMatchObject({
        scheduledGameCount: 240,
        storedGameCount: 12,
        completedGameCount: 12,
        unterminatedGameCount: 0,
        scoredPairCount: 6,
        connectivity: { isConnected: true },
      })
      expect(input).toMatchObject({
        scheduledPairCount: 120,
        completedPairCount: 6,
        completedGameCount: 12,
        excludedPairCount: 114,
      })
      expect(ratingEvidence).toMatchObject({
        planId: standardChickenCandidatePlan.planId,
        completedPairCount: 6,
        completedGameCount: 12,
        excludedPairCount: 114,
        bridgeOffset: {
          anchorElo: 1320,
          policyFingerprint: STANDARD_CHICKEN_ANCHOR.policyFingerprint,
        },
      })
      expect(ratingEvidence.ratings).toHaveLength(7)
      expect(ratingEvidence.likelihoodOfSuperiority).toHaveLength(42)
      expect(shortlist).toMatchObject({
        status: "no-justified-shortlist",
        reasons: ["incomplete-evidence"],
        rankedCandidates: [],
        bracket: null,
      })
    } finally {
      await rm(rootDirectory, { force: true, recursive: true })
    }
  }, 180_000)
})

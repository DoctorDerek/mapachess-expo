import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  STALEMATE_FEN,
  standardPlanFixture,
  standardPolicyFixture,
} from "../test/calibrationFixtures"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
} from "./calibrationPlan"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"
import summarizeCalibrationSmokeEvidence from "./calibrationSmokeSummary"

const temporaryRoots: string[] = []

async function temporaryEvidenceRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mapachess-smoke-summary-"))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, {
        force: true,
        recursive: true,
      }),
    ),
  )
})

const unexpectedEngine = () => {
  throw new Error("A terminal fixture must not open Stockfish.")
}

describe("calibration smoke evidence summaries", () => {
  it("withholds scores and connectivity until both paired games exist", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const plan = standardPlanFixture()
    const batchInput = {
      rootDirectory,
      plan,
      maxPlies: 10,
      maximumNewGames: 1,
      openEngine: unexpectedEngine,
    }
    await executeCalibrationSmokeBatch(batchInput)

    const partial = await summarizeCalibrationSmokeEvidence({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    expect(partial).toMatchObject({
      scheduledGameCount: 2,
      storedGameCount: 1,
      completedGameCount: 1,
      unterminatedGameCount: 0,
      scoredPairCount: 0,
      connectivity: { isConnected: false },
      edges: [
        {
          edgeId: "fixture-edge",
          scheduledPairCount: 1,
          scoredPairCount: 0,
          incompletePairCount: 1,
        },
      ],
    })
    expect(
      partial.policyScores.every(
        (score) => score.scoredGames === 0 && score.scoreHalfPoints === 0,
      ),
    ).toBe(true)

    await executeCalibrationSmokeBatch(batchInput)
    const complete = await summarizeCalibrationSmokeEvidence({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    expect(complete).toMatchObject({
      storedGameCount: 2,
      completedGameCount: 2,
      scoredPairCount: 1,
      connectivity: { isConnected: true },
      edges: [
        {
          scoredPairCount: 1,
          incompletePairCount: 0,
        },
      ],
    })
    expect(complete.connectivity.components).toEqual([
      plan.policies.map(({ fingerprint }) => fingerprint).sort(),
    ])
    expect(complete.policyScores).toEqual(
      plan.policies.map(({ fingerprint }) => ({
        policyFingerprint: fingerprint,
        scoredGames: 2,
        wins: 0,
        draws: 2,
        losses: 0,
        scoreHalfPoints: 2,
      })),
    )
  })

  it("connects policy chains transitively across completed edges", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const plan = createCalibrationPlan({
      schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
      seed: 42,
      variant: "standard",
      openings: [{ id: "stalemate", fen: STALEMATE_FEN }],
      edges: [
        {
          id: "low-middle",
          pairsPerOpening: 1,
          policyA: standardPolicyFixture(1_000),
          policyB: standardPolicyFixture(2_000),
        },
        {
          id: "middle-high",
          pairsPerOpening: 1,
          policyA: standardPolicyFixture(2_000),
          policyB: standardPolicyFixture(3_000),
        },
      ],
    })
    await executeCalibrationSmokeBatch({
      rootDirectory,
      plan,
      maxPlies: 10,
      maximumNewGames: plan.games.length,
      openEngine: unexpectedEngine,
    })

    const summary = await summarizeCalibrationSmokeEvidence({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    expect(summary.scoredPairCount).toBe(2)
    expect(summary.edges).toHaveLength(2)
    expect(summary.connectivity).toEqual({
      isConnected: true,
      components: [plan.policies.map(({ fingerprint }) => fingerprint).sort()],
    })
    expect(
      summary.policyScores.map((score) => score.scoredGames).sort(),
    ).toEqual([2, 2, 4])
  })
})

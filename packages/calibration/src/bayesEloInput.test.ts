import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  onePlyUnterminatedEvidenceFixture,
  standardPlanFixture,
} from "../test/calibrationFixtures"
import createBayesEloInput, {
  BAYES_ELO_INPUT_SCHEMA_VERSION,
} from "./bayesEloInput"
import persistCalibrationGameEvidence from "./calibrationEvidenceStore"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"

const temporaryRoots: string[] = []

async function temporaryEvidenceRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mapachess-bayeselo-input-"))
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

describe("BayesElo input", () => {
  it("exports only a both-completed pair with deterministic short aliases", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const plan = standardPlanFixture()
    const pair = plan.games[0]
    const firstPolicy = plan.policies[0]
    const secondPolicy = plan.policies[1]
    if (
      pair === undefined ||
      firstPolicy === undefined ||
      secondPolicy === undefined
    ) {
      throw new Error("BayesElo input fixture is incomplete.")
    }
    const batchInput = {
      rootDirectory,
      plan,
      maxPlies: 10,
      maximumNewGames: 1,
      openEngine: unexpectedEngine,
    }
    await executeCalibrationSmokeBatch(batchInput)

    const partial = await createBayesEloInput({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    expect(partial).toMatchObject({
      schemaVersion: BAYES_ELO_INPUT_SCHEMA_VERSION,
      scheduledPairCount: 1,
      completedPairCount: 0,
      completedGameCount: 0,
      excludedPairCount: 1,
      completedPairIds: [],
      pgn: "",
    })

    await executeCalibrationSmokeBatch(batchInput)
    const complete = await createBayesEloInput({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    const repeated = await createBayesEloInput({
      rootDirectory,
      plan,
      maxPlies: 10,
    })

    expect(complete).toEqual(repeated)
    expect(complete).toMatchObject({
      scheduledPairCount: 1,
      completedPairCount: 1,
      completedGameCount: 2,
      excludedPairCount: 0,
      completedPairIds: [pair.pairId],
      policyAliases: [
        { alias: "P001", policyFingerprint: firstPolicy.fingerprint },
        { alias: "P002", policyFingerprint: secondPolicy.fingerprint },
      ],
    })
    expect(complete.pgn.match(/\[White "P\d{3}"\]/g)).toHaveLength(2)
    expect(complete.pgn.match(/\[Black "P\d{3}"\]/g)).toHaveLength(2)
    expect(complete.pgn.match(/\[Result "1\/2-1\/2"\]/g)).toHaveLength(2)
    expect(complete.inputSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(complete.pgnSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it("excludes unterminated evidence from the rating input", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = onePlyUnterminatedEvidenceFixture()
    await persistCalibrationGameEvidence({ rootDirectory, plan, evidence })

    await expect(
      createBayesEloInput({ rootDirectory, plan, maxPlies: 1 }),
    ).resolves.toMatchObject({
      scheduledPairCount: 1,
      completedPairCount: 0,
      excludedPairCount: 1,
      pgn: "",
    })
  })

  it("keeps Standard and Chess960 rating pools separate", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const standardPlan = standardPlanFixture()

    await expect(
      createBayesEloInput({
        rootDirectory,
        plan: { ...standardPlan, variant: "chess960" },
        maxPlies: 10,
      }),
    ).rejects.toThrow("BayesElo input currently supports Standard only.")
  })
})

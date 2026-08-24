import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  mateInOneEvidenceFixture,
  onePlyUnterminatedEvidenceFixture,
  standardPlanFixture,
} from "../test/calibrationFixtures"
import persistCalibrationGameEvidence, {
  loadStoredCalibrationGame,
  resolveCalibrationEvidencePaths,
} from "./calibrationEvidenceStore"

const temporaryRoots: string[] = []

async function temporaryEvidenceRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mapachess-calibration-"))
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

describe("calibration evidence storage", () => {
  it("persists once and resumes from verified completed evidence", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = mateInOneEvidenceFixture()
    const input = { rootDirectory, plan, evidence }
    const first = await persistCalibrationGameEvidence(input)
    const second = await persistCalibrationGameEvidence(input)

    expect(first.disposition).toBe("created")
    expect(second).toEqual({
      disposition: "existing",
      storedGame: first.storedGame,
    })
    expect(first.storedGame.marker).toMatchObject({
      planId: plan.planId,
      gameId: evidence.game.gameId,
      maxPlies: evidence.maxPlies,
      resultStatus: "completed",
      resultTag: "1-0",
      termination: "checkmate",
    })
    expect(first.storedGame.pgnPath).toBeDefined()
    if (first.storedGame.pgnPath === undefined) {
      throw new Error("Stored completed game PGN is missing.")
    }
    expect(await readFile(first.storedGame.pgnPath, "utf8")).toMatch(
      /1\. Qg7# 1-0\n$/,
    )

    const paths = resolveCalibrationEvidencePaths(
      rootDirectory,
      plan,
      evidence.game,
    )
    expect(await readdir(paths.planDirectory)).toEqual([
      `${evidence.game.pairId.slice("sha256:".length)}-game-${evidence.game.gameInPair}`,
    ])
  })

  it("returns undefined when the scheduled game has no evidence", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = mateInOneEvidenceFixture()

    await expect(
      loadStoredCalibrationGame({
        rootDirectory,
        plan,
        game: evidence.game,
        maxPlies: evidence.maxPlies,
      }),
    ).resolves.toBeUndefined()
  })

  it("stores an exhausted game without manufacturing a PGN result", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = onePlyUnterminatedEvidenceFixture()

    const persisted = await persistCalibrationGameEvidence({
      rootDirectory,
      plan,
      evidence,
    })

    expect(persisted.storedGame).toMatchObject({
      marker: {
        resultStatus: "unterminated",
        resultTag: "*",
        termination: "max-plies",
      },
    })
    expect(persisted.storedGame.pgnPath).toBeUndefined()
    expect((await readdir(persisted.storedGame.gameDirectory)).sort()).toEqual([
      "complete.json",
      "evidence.json",
    ])
  })

  it("rejects mismatched evidence before accepting an existing game", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = mateInOneEvidenceFixture()
    await persistCalibrationGameEvidence({ rootDirectory, plan, evidence })
    const differentPlan = standardPlanFixture(undefined, 43)

    await expect(
      persistCalibrationGameEvidence({
        rootDirectory,
        plan,
        evidence: { ...evidence, planId: differentPlan.planId },
      }),
    ).rejects.toThrow("evidence does not match its plan")
  })

  it("rejects a changed execution bound or corrupted evidence", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = mateInOneEvidenceFixture()
    const persisted = await persistCalibrationGameEvidence({
      rootDirectory,
      plan,
      evidence,
    })

    await expect(
      loadStoredCalibrationGame({
        rootDirectory,
        plan,
        game: evidence.game,
        maxPlies: evidence.maxPlies + 1,
      }),
    ).rejects.toThrow("maxPlies does not match")

    await writeFile(persisted.storedGame.evidencePath, "tampered\n", "utf8")
    await expect(
      loadStoredCalibrationGame({
        rootDirectory,
        plan,
        game: evidence.game,
        maxPlies: evidence.maxPlies,
      }),
    ).rejects.toThrow("evidence SHA-256 does not match")
  })
})

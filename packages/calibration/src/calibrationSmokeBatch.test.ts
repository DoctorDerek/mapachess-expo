import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import { CalibrationExecutionAbortedError } from "./calibrationGameExecutor"
import type { OpenCalibrationEngine } from "./calibrationGameTypes"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"

const temporaryRoots: string[] = []

async function temporaryEvidenceRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mapachess-smoke-batch-"))
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

describe("calibration smoke-batch execution", () => {
  it("executes only the requested missing games across resumptions", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const plan = standardPlanFixture()
    const firstGame = plan.games[0]
    const secondGame = plan.games[1]
    if (firstGame === undefined || secondGame === undefined) {
      throw new Error("Smoke-batch fixture pair is incomplete.")
    }
    const unexpectedEngine: OpenCalibrationEngine = () => {
      throw new Error("A terminal fixture must not open Stockfish.")
    }
    const input = {
      rootDirectory,
      plan,
      maxPlies: 10,
      maximumNewGames: 1,
      openEngine: unexpectedEngine,
    }

    const first = await executeCalibrationSmokeBatch(input)
    expect(first).toEqual({
      planId: plan.planId,
      previouslyStoredGameIds: [],
      executedGameIds: [firstGame.gameId],
      remainingGameIds: [secondGame.gameId],
    })

    const second = await executeCalibrationSmokeBatch(input)
    expect(second).toEqual({
      planId: plan.planId,
      previouslyStoredGameIds: [firstGame.gameId],
      executedGameIds: [secondGame.gameId],
      remainingGameIds: [],
    })

    const third = await executeCalibrationSmokeBatch(input)
    expect(third).toEqual({
      planId: plan.planId,
      previouslyStoredGameIds: plan.games.map((game) => game.gameId),
      executedGameIds: [],
      remainingGameIds: [],
    })
  })

  it("rejects invalid bounds and Chess960 before opening an engine", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const plan = standardPlanFixture()
    let openEngineCalls = 0
    const openEngine: OpenCalibrationEngine = () => {
      openEngineCalls += 1
      throw new Error("Invalid batches must not open Stockfish.")
    }
    const input = {
      rootDirectory,
      plan,
      maxPlies: 10,
      maximumNewGames: 1,
      openEngine,
    }

    await expect(
      executeCalibrationSmokeBatch({ ...input, maximumNewGames: 0 }),
    ).rejects.toThrow("maximumNewGames must be a positive safe integer")
    await expect(
      executeCalibrationSmokeBatch({
        ...input,
        plan: { ...plan, variant: "chess960" },
      }),
    ).rejects.toThrow("currently supports Standard only")
    expect(openEngineCalls).toBe(0)
  })

  it("honors an existing abort before inspecting or running the batch", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const abortController = new AbortController()
    abortController.abort()

    await expect(
      executeCalibrationSmokeBatch({
        rootDirectory,
        plan: standardPlanFixture(),
        maxPlies: 10,
        maximumNewGames: 1,
        openEngine: () => {
          throw new Error("An aborted batch must not open Stockfish.")
        },
        signal: abortController.signal,
      }),
    ).rejects.toBeInstanceOf(CalibrationExecutionAbortedError)
  })
})

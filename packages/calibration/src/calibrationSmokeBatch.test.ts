import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  chess960PlanFixture,
  STALEMATE_FEN,
  standardPlanFixture,
} from "../test/calibrationFixtures"
import { CalibrationExecutionAbortedError } from "./calibrationGameExecutor"
import type { OpenCalibrationEngine } from "./calibrationGameTypes"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"
import summarizeCalibrationSmokeEvidence from "./calibrationSmokeSummary"

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
  it.each(["standard", "chess960"] as const)(
    "executes only missing %s games across resumptions",
    async (variant) => {
      const rootDirectory = await temporaryEvidenceRoot()
      const plan =
        variant === "standard"
          ? standardPlanFixture()
          : chess960PlanFixture(STALEMATE_FEN)
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
      expect(
        await summarizeCalibrationSmokeEvidence({
          rootDirectory,
          plan,
          maxPlies: 10,
        }),
      ).toMatchObject({
        variant,
        completedGameCount: 2,
        scoredPairCount: 1,
        unterminatedGameCount: 0,
        connectivity: { isConnected: true },
      })
    },
  )

  it("rejects invalid bounds and mixed variants before opening an engine", async () => {
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
    ).rejects.toThrow("games must use their plan variant")
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

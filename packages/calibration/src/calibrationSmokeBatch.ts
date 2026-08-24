import persistCalibrationGameEvidence, {
  loadStoredCalibrationGame,
} from "./calibrationEvidenceStore.js"
import createCalibrationGameEvidence from "./calibrationGameEvidence.js"
import executeCalibrationGame, {
  CalibrationExecutionAbortedError,
} from "./calibrationGameExecutor.js"
import type {
  CalibrationGameExecutionInput,
  OpenCalibrationEngine,
} from "./calibrationGameTypes.js"
import type {
  CalibrationGame,
  CalibrationGameId,
  CalibrationPlan,
} from "./calibrationPlan.js"

export type ExecuteCalibrationSmokeBatchInput = Readonly<{
  maximumNewGames: number
  maxPlies: number
  openEngine: OpenCalibrationEngine
  plan: CalibrationPlan
  rootDirectory: string
  signal?: AbortSignal
}>

export type CalibrationSmokeBatchResult = Readonly<{
  executedGameIds: readonly CalibrationGameId[]
  planId: CalibrationPlan["planId"]
  previouslyStoredGameIds: readonly CalibrationGameId[]
  remainingGameIds: readonly CalibrationGameId[]
}>

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new CalibrationExecutionAbortedError()
  }
}

async function pendingGames(
  input: ExecuteCalibrationSmokeBatchInput,
  previouslyStoredGameIds: CalibrationGameId[],
): Promise<CalibrationGame[]> {
  const pending: CalibrationGame[] = []

  for (const game of input.plan.games) {
    const stored = await loadStoredCalibrationGame({
      rootDirectory: input.rootDirectory,
      plan: input.plan,
      game,
      maxPlies: input.maxPlies,
    })

    if (stored === undefined) pending.push(game)
    else previouslyStoredGameIds.push(game.gameId)
  }

  return pending
}

export default async function executeCalibrationSmokeBatch(
  input: ExecuteCalibrationSmokeBatchInput,
): Promise<CalibrationSmokeBatchResult> {
  assertPositiveSafeInteger(input.maximumNewGames, "maximumNewGames")
  assertPositiveSafeInteger(input.maxPlies, "maxPlies")
  if (input.plan.variant !== "standard") {
    throw new TypeError(
      "Smoke-batch execution currently supports Standard only.",
    )
  }

  throwIfAborted(input.signal)
  const previouslyStoredGameIds: CalibrationGameId[] = []
  const pending = await pendingGames(input, previouslyStoredGameIds)
  throwIfAborted(input.signal)
  const gamesToExecute = pending.slice(0, input.maximumNewGames)
  const executedGameIds: CalibrationGameId[] = []

  for (const game of gamesToExecute) {
    const executionInput: CalibrationGameExecutionInput = {
      openEngine: input.openEngine,
      game,
      maxPlies: input.maxPlies,
      policies: input.plan.policies,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    }
    const result = await executeCalibrationGame(executionInput)
    const evidence = createCalibrationGameEvidence({
      plan: input.plan,
      maxPlies: input.maxPlies,
      result,
    })
    await persistCalibrationGameEvidence({
      rootDirectory: input.rootDirectory,
      plan: input.plan,
      evidence,
    })
    executedGameIds.push(game.gameId)
  }

  return {
    planId: input.plan.planId,
    previouslyStoredGameIds,
    executedGameIds,
    remainingGameIds: pending
      .slice(gamesToExecute.length)
      .map((game) => game.gameId),
  }
}

import nativeStockfishModule from "@mapachess/stockfish-native/native-module"
import NativeStockfishSession from "@mapachess/stockfish-native/session"
import {
  StockfishOperationAbortedError,
  type StockfishEngineConfiguration,
  type StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"

export const ENGINE_PROOF_STEPS = [
  { id: "boot", label: "Boot embedded Stockfish" },
  { id: "cancel", label: "Cancel and drain an active search" },
  { id: "search", label: "Complete a deterministic search" },
  { id: "close", label: "Close the native engine session" },
] as const

export type EngineProofStep = (typeof ENGINE_PROOF_STEPS)[number]["id"]

export type EngineProofProgress = Readonly<{
  completedSteps: readonly EngineProofStep[]
  currentStep: EngineProofStep
}>

export type EngineProofResult =
  | Readonly<{
      bestMove: string
      completedSteps: readonly EngineProofStep[]
      engineName: string
      nodeLimit: number
      status: "passed"
    }>
  | Readonly<{
      completedSteps: readonly EngineProofStep[]
      failedStep: EngineProofStep
      message: string
      status: "failed"
    }>

const STANDARD_STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const COMPLETED_SEARCH_NODE_LIMIT = 10_000
const CANCELLED_SEARCH_NODE_LIMIT = 10_000_000

const ENGINE_CONFIGURATION = {
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: { kind: "full-strength" },
  threads: 1,
  variant: "standard",
} as const satisfies StockfishEngineConfiguration

function searchRequest(
  requestId: string,
  nodeLimit: number,
): StockfishSearchRequest {
  return {
    nodeLimit,
    position: { fen: STANDARD_STARTING_FEN, moves: [] },
    requestId,
  }
}

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown native engine error."
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new StockfishOperationAbortedError("engine proof")
  }
}

export default async function runNativeStockfishProof(
  signal: AbortSignal,
  onProgress: (progress: EngineProofProgress) => void,
): Promise<EngineProofResult> {
  const session = new NativeStockfishSession(
    ENGINE_CONFIGURATION,
    nativeStockfishModule,
  )
  const completedSteps: EngineProofStep[] = []
  let currentStep: EngineProofStep = "boot"
  let engineName = ""
  let bestMove = ""
  let failure: Readonly<{ error: unknown; step: EngineProofStep }> | undefined

  const beginStep = (step: EngineProofStep): void => {
    currentStep = step
    onProgress({ completedSteps: [...completedSteps], currentStep })
  }
  const completeStep = (): void => {
    completedSteps.push(currentStep)
  }

  try {
    beginStep("boot")
    const identity = await session.boot(signal)
    engineName = identity.name
    completeStep()

    beginStep("cancel")
    const cancellationController = new AbortController()
    const cancelledSearch = session.search(
      searchRequest("engine-proof/cancel", CANCELLED_SEARCH_NODE_LIMIT),
      cancellationController.signal,
    )
    cancellationController.abort()
    try {
      await cancelledSearch
      throw new Error("The cancellation proof unexpectedly completed a search.")
    } catch (error) {
      if (!(error instanceof StockfishOperationAbortedError)) throw error
    }
    completeStep()

    beginStep("search")
    assertNotAborted(signal)
    const result = await session.search(
      searchRequest("engine-proof/complete", COMPLETED_SEARCH_NODE_LIMIT),
      signal,
    )
    if (result.bestMove === null) {
      throw new Error("Stockfish returned no move from the starting position.")
    }
    bestMove = result.bestMove
    completeStep()
  } catch (error) {
    failure = { error, step: currentStep }
  } finally {
    beginStep("close")
    try {
      await session.close()
      completeStep()
    } catch (error) {
      failure ??= { error, step: "close" }
    }
  }

  if (failure !== undefined) {
    return {
      completedSteps,
      failedStep: failure.step,
      message: messageFromUnknown(failure.error),
      status: "failed",
    }
  }

  return {
    bestMove,
    completedSteps,
    engineName,
    nodeLimit: COMPLETED_SEARCH_NODE_LIMIT,
    status: "passed",
  }
}

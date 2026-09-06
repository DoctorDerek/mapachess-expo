import { evaluatePositionWithStockfish } from "@mapachess/evaluation/position-evaluator"
import createBetterHintsAnalyst, {
  BETTER_HINTS_ENGINE_MULTIPV,
} from "@mapachess/hints/better-hints"
import type { MatchStartingPosition } from "@mapachess/match/match-position"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import type { DeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import createStandardChickenOpponent, {
  generateStandardChickenMatchSeed,
  selectStandardStoryPlayerColor,
  STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
  standardChickenMatchId,
  type StandardChickenCryptography,
} from "../chicken/standardChickenOpponent"
import createWebStockfishSession, {
  type CreateWebStockfishSessionOptions,
} from "../stockfish/createWebStockfishSession"
import type { WebMatchRuntime } from "./webMatchRuntime"

const SINGLE_PV_ENGINE_CONFIGURATION: StockfishEngineConfiguration =
  Object.freeze({
    hashMegabytes: 16,
    multiPv: 1,
    ponder: false,
    strength: Object.freeze({ kind: "full-strength" as const }),
    threads: 1,
    variant: "standard",
  })

const OPPONENT_WORKER_NAME = "mapachess-stockfish-18-opponent" as const
const HINT_WORKER_NAME = "mapachess-stockfish-18-better-hints" as const
const EVALUATION_WORKER_NAME = "mapachess-stockfish-18-evaluation" as const

export type OpenWebMatchRuntimeInput = Readonly<{
  cryptography?: StandardChickenCryptography
  openSession?: (
    configuration: StockfishEngineConfiguration,
    options?: CreateWebStockfishSessionOptions,
  ) => StockfishUciSession
  matchSeed?: DeterministicRandomSeed
  startingPosition?: MatchStartingPosition
  signal?: AbortSignal
}>

const closeOwnedSessions = async (
  sessions: readonly StockfishUciSession[],
): Promise<void> => {
  const results = await Promise.allSettled(
    sessions.map((session) => session.close()),
  )
  const errors: unknown[] = []
  for (const result of results) {
    if (result.status === "rejected") {
      const reason: unknown = result.reason
      errors.push(reason)
    }
  }

  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "Web match sessions failed to close cleanly.",
    )
  }
}

const closeAfterFailedOpen = async (
  sessions: readonly StockfishUciSession[],
  openError: unknown,
): Promise<never> => {
  try {
    await closeOwnedSessions(sessions)
  } catch (closeError) {
    const closeErrors: readonly unknown[] =
      closeError instanceof AggregateError ? closeError.errors : [closeError]
    throw new AggregateError(
      [openError, ...closeErrors],
      "Web match failed to open and close cleanly.",
    )
  }

  throw openError
}

export default async function openWebMatchRuntime(
  input: OpenWebMatchRuntimeInput = {},
): Promise<WebMatchRuntime> {
  const startingPosition = input.startingPosition ?? {
    chess960PositionId: null,
    variant: "standard",
  }
  const singlePvConfiguration: StockfishEngineConfiguration = {
    ...SINGLE_PV_ENGINE_CONFIGURATION,
    variant: startingPosition.variant,
  }
  const cryptography = input.cryptography ?? globalThis.crypto
  const matchSeed =
    input.matchSeed ?? generateStandardChickenMatchSeed(cryptography)
  const openSession = input.openSession ?? createWebStockfishSession
  const opponentSession = openSession(singlePvConfiguration, {
    workerName: OPPONENT_WORKER_NAME,
  })
  let hintSession: StockfishUciSession
  try {
    hintSession = openSession(
      { ...singlePvConfiguration, multiPv: BETTER_HINTS_ENGINE_MULTIPV },
      { workerName: HINT_WORKER_NAME },
    )
  } catch (error) {
    return closeAfterFailedOpen([opponentSession], error)
  }
  let evaluationSession: StockfishUciSession
  try {
    evaluationSession = openSession(singlePvConfiguration, {
      workerName: EVALUATION_WORKER_NAME,
    })
  } catch (error) {
    return closeAfterFailedOpen([opponentSession, hintSession], error)
  }
  const sessions = [opponentSession, hintSession, evaluationSession] as const

  let engineIdentity: StockfishUciIdentity
  try {
    engineIdentity = await opponentSession.boot(input.signal)
    await hintSession.boot(input.signal)
    await evaluationSession.boot(input.signal)
    if (input.signal?.aborted === true) {
      throw new DOMException("Web match opening was aborted.", "AbortError")
    }
  } catch (error) {
    return closeAfterFailedOpen(sessions, error)
  }

  return Object.freeze({
    close: () => closeOwnedSessions(sessions),
    engineIdentity,
    hintAnalyst: createBetterHintsAnalyst({ engine: hintSession }),
    matchId: standardChickenMatchId(matchSeed),
    matchSeed,
    opponent: createStandardChickenOpponent(
      opponentSession,
      cryptography,
      matchSeed,
    ),
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
    playerColor: selectStandardStoryPlayerColor(matchSeed),
    positionEvaluator: (request, signal) =>
      evaluatePositionWithStockfish(evaluationSession, request, signal),
  })
}

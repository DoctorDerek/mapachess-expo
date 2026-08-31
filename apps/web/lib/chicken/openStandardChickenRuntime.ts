import createBetterHintsAnalyst, {
  BETTER_HINTS_ENGINE_MULTIPV,
} from "@mapachess/hints/better-hints"
import type { BetterHintsAnalyst } from "@mapachess/match/better-hints"
import type { MatchOpponent } from "@mapachess/match/match-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import type { DeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import createWebStockfishSession, {
  type CreateWebStockfishSessionOptions,
} from "../stockfish/createWebStockfishSession"
import createStandardChickenOpponent, {
  generateStandardChickenMatchSeed,
  selectStandardStoryPlayerColor,
  STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
  standardChickenMatchId,
  type StandardChickenCryptography,
} from "./standardChickenOpponent"

const STANDARD_CHICKEN_ENGINE_CONFIGURATION: StockfishEngineConfiguration =
  Object.freeze({
    hashMegabytes: 16,
    multiPv: 1,
    ponder: false,
    strength: Object.freeze({ kind: "full-strength" as const }),
    threads: 1,
    variant: "standard",
  })

const STANDARD_CHICKEN_HINT_ENGINE_CONFIGURATION: StockfishEngineConfiguration =
  Object.freeze({
    hashMegabytes: 16,
    multiPv: BETTER_HINTS_ENGINE_MULTIPV,
    ponder: false,
    strength: Object.freeze({ kind: "full-strength" as const }),
    threads: 1,
    variant: "standard",
  })

const STANDARD_CHICKEN_OPPONENT_WORKER_NAME =
  "mapachess-stockfish-18-opponent" as const
const STANDARD_CHICKEN_HINT_WORKER_NAME =
  "mapachess-stockfish-18-better-hints" as const

export type StandardChickenRuntime = Readonly<{
  close: () => Promise<void>
  engineIdentity: StockfishUciIdentity
  hintAnalyst: BetterHintsAnalyst
  matchId: string
  matchSeed: DeterministicRandomSeed
  opponent: MatchOpponent
  opponentPolicyFingerprint: string
  playerColor: MatchColor
}>

export type OpenStandardChickenRuntimeInput = Readonly<{
  cryptography?: StandardChickenCryptography
  openSession?: (
    configuration: StockfishEngineConfiguration,
    options?: CreateWebStockfishSessionOptions,
  ) => StockfishUciSession
  matchSeed?: DeterministicRandomSeed
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
      "Standard Chicken sessions failed to close cleanly.",
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
      "Standard Chicken failed to open and close cleanly.",
    )
  }

  throw openError
}

export default async function openStandardChickenRuntime(
  input: OpenStandardChickenRuntimeInput = {},
): Promise<StandardChickenRuntime> {
  const cryptography = input.cryptography ?? globalThis.crypto
  const matchSeed =
    input.matchSeed ?? generateStandardChickenMatchSeed(cryptography)
  const openSession = input.openSession ?? createWebStockfishSession
  const opponentSession = openSession(STANDARD_CHICKEN_ENGINE_CONFIGURATION, {
    workerName: STANDARD_CHICKEN_OPPONENT_WORKER_NAME,
  })
  let hintSession: StockfishUciSession
  try {
    hintSession = openSession(STANDARD_CHICKEN_HINT_ENGINE_CONFIGURATION, {
      workerName: STANDARD_CHICKEN_HINT_WORKER_NAME,
    })
  } catch (error) {
    return closeAfterFailedOpen([opponentSession], error)
  }
  const sessions = [opponentSession, hintSession] as const

  let engineIdentity: StockfishUciIdentity
  try {
    engineIdentity = await opponentSession.boot(input.signal)
    await hintSession.boot(input.signal)
    if (input.signal?.aborted === true) {
      throw new DOMException(
        "Standard Chicken opening was aborted.",
        "AbortError",
      )
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
    opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
    playerColor: selectStandardStoryPlayerColor(matchSeed),
  })
}

import type { MatchOpponent } from "@mapachess/match/match-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import type { DeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import createWebStockfishSession from "../stockfish/createWebStockfishSession"
import createStandardChickenOpponent, {
  generateStandardChickenMatchSeed,
  selectStandardStoryPlayerColor,
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

export type StandardChickenRuntime = Readonly<{
  close: () => Promise<void>
  engineIdentity: StockfishUciIdentity
  matchId: string
  matchSeed: DeterministicRandomSeed
  opponent: MatchOpponent
  playerColor: MatchColor
}>

export type OpenStandardChickenRuntimeInput = Readonly<{
  cryptography?: StandardChickenCryptography
  openSession?: (
    configuration: StockfishEngineConfiguration,
  ) => StockfishUciSession
  signal?: AbortSignal
}>

const closeAfterFailedOpen = async (
  session: StockfishUciSession,
  openError: unknown,
): Promise<never> => {
  try {
    await session.close()
  } catch (closeError) {
    throw new AggregateError(
      [openError, closeError],
      "Standard Chicken failed to open and close cleanly.",
    )
  }

  throw openError
}

export default async function openStandardChickenRuntime(
  input: OpenStandardChickenRuntimeInput = {},
): Promise<StandardChickenRuntime> {
  const cryptography = input.cryptography ?? globalThis.crypto
  const matchSeed = generateStandardChickenMatchSeed(cryptography)
  const session = (input.openSession ?? createWebStockfishSession)(
    STANDARD_CHICKEN_ENGINE_CONFIGURATION,
  )

  let engineIdentity: StockfishUciIdentity
  try {
    engineIdentity = await session.boot(input.signal)
    if (input.signal?.aborted === true) {
      throw new DOMException(
        "Standard Chicken opening was aborted.",
        "AbortError",
      )
    }
  } catch (error) {
    return closeAfterFailedOpen(session, error)
  }

  return Object.freeze({
    close: () => session.close(),
    engineIdentity,
    matchId: `standard-story-chicken/${matchSeed}`,
    matchSeed,
    opponent: createStandardChickenOpponent(session, cryptography, matchSeed),
    playerColor: selectStandardStoryPlayerColor(matchSeed),
  })
}

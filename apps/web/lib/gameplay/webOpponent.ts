import createMatchOpponent, {
  generateMatchSeed,
} from "@mapachess/gameplay/opponent"
import {
  CHESS960_POSITION_COUNT,
  parseChess960PositionId,
  type Chess960PositionId,
} from "@mapachess/match/chess960-position"
import type { MatchOpponent } from "@mapachess/match/match-machine"
import type { StockfishEngineSession } from "@mapachess/stockfish/engine-session"
import {
  createDeterministicRandom,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"
import type { WebOpponentPolicy } from "./webOpponentPolicy"

export type WebOpponentCryptography = Readonly<{
  getRandomValues: Crypto["getRandomValues"]
  subtle: Pick<SubtleCrypto, "digest">
}>

export function generateWebMatchSeed(
  cryptography: WebOpponentCryptography,
): DeterministicRandomSeed {
  return generateMatchSeed((words) => cryptography.getRandomValues(words))
}

export function generateWebChess960Position(
  cryptography: WebOpponentCryptography,
): Chess960PositionId {
  const random = createDeterministicRandom(generateWebMatchSeed(cryptography))
  const parsed = parseChess960PositionId(
    random.nextIndex(CHESS960_POSITION_COUNT),
  )
  if (!parsed.ok) throw new Error("Generated Chess960 position is invalid.")
  return parsed.positionId
}

export default function createWebOpponent(
  session: StockfishEngineSession,
  cryptography: WebOpponentCryptography,
  matchSeed: DeterministicRandomSeed,
  policy: WebOpponentPolicy,
): MatchOpponent {
  return createMatchOpponent(
    session,
    (bytes) => cryptography.subtle.digest("SHA-256", bytes),
    matchSeed,
    policy,
  )
}

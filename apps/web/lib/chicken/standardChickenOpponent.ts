import type {
  MatchOpponent,
  MatchOpponentRequest,
} from "@mapachess/match/match-machine"
import type { LegalMatchMove } from "@mapachess/match/match-move"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import {
  createDeterministicRandom,
  parseDeterministicRandomSeed,
  selectOpponentMoveSource,
  selectUniformRandomLegalMove,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"
import {
  STOCKFISH_18_WEB_SOURCE_REVISION,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "@mapachess/stockfish/web-runtime-identity"

export const STANDARD_CHICKEN_NODE_LIMIT = 10_000 as const
export const STANDARD_CHICKEN_RANDOM_MOVE_BASIS_POINTS = 8_000 as const
export const STANDARD_CHICKEN_WEB_SEED_DERIVATION_VERSION =
  "mapachess-web-sha256-position-state/v1" as const
export const STANDARD_CHICKEN_WEB_POLICY_VERSION =
  "mapachess-standard-chicken-web-policy/v1" as const
export const STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT = [
  STANDARD_CHICKEN_WEB_POLICY_VERSION,
  `stockfish-js-source/${STOCKFISH_18_WEB_SOURCE_REVISION}`,
  `wasm-sha256/${STOCKFISH_18_WEB_WASM_ARTIFACT.sha256}`,
  `nodes/${String(STANDARD_CHICKEN_NODE_LIMIT)}`,
  `random-basis-points/${String(STANDARD_CHICKEN_RANDOM_MOVE_BASIS_POINTS)}`,
  STANDARD_CHICKEN_WEB_SEED_DERIVATION_VERSION,
].join("|")

export type StandardChickenCryptography = Readonly<{
  getRandomValues: Crypto["getRandomValues"]
  subtle: Pick<SubtleCrypto, "digest">
}>

const textEncoder = new TextEncoder()

const throwIfSelectionAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new StockfishOperationAbortedError("opponent move selection")
  }
}

const hexadecimalByte = (value: number): string =>
  value.toString(16).padStart(2, "0")

const first128BitsAsHexadecimal = (digest: ArrayBuffer): string =>
  [...new Uint8Array(digest).slice(0, 16)].map(hexadecimalByte).join("")

const compareLegalMovesByUci = (
  left: LegalMatchMove,
  right: LegalMatchMove,
): number => (left.uci < right.uci ? -1 : left.uci > right.uci ? 1 : 0)

export function generateStandardChickenMatchSeed(
  cryptography: StandardChickenCryptography,
): DeterministicRandomSeed {
  const words = cryptography.getRandomValues(new Uint32Array(4))
  const seed = [...words]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")

  return parseDeterministicRandomSeed(seed, "Standard Chicken match seed")
}

export function selectStandardStoryPlayerColor(
  matchSeed: DeterministicRandomSeed,
): "black" | "white" {
  const random = createDeterministicRandom(matchSeed)
  return random.nextIndex(2) === 0 ? "white" : "black"
}

export function standardChickenMatchId(
  matchSeed: DeterministicRandomSeed,
): string {
  return `standard-story-chicken/${matchSeed}`
}

async function deriveOpponentPositionSeed(
  cryptography: StandardChickenCryptography,
  matchSeed: DeterministicRandomSeed,
  request: MatchOpponentRequest,
  signal: AbortSignal,
): Promise<DeterministicRandomSeed> {
  throwIfSelectionAborted(signal)
  const canonicalInput = JSON.stringify([
    STANDARD_CHICKEN_WEB_SEED_DERIVATION_VERSION,
    matchSeed,
    request.requestId,
  ])
  const digest = await cryptography.subtle.digest(
    "SHA-256",
    textEncoder.encode(canonicalInput),
  )
  throwIfSelectionAborted(signal)

  return parseDeterministicRandomSeed(
    first128BitsAsHexadecimal(digest),
    "Standard Chicken position seed",
  )
}

const requireStandardPosition = (request: MatchOpponentRequest): void => {
  if (
    request.initialPosition.variant !== "standard" ||
    request.position.variant !== "standard"
  ) {
    throw new TypeError("Standard Chicken received a non-Standard position.")
  }
}

export default function createStandardChickenOpponent(
  session: StockfishEngineSession,
  cryptography: StandardChickenCryptography,
  matchSeed: DeterministicRandomSeed,
): MatchOpponent {
  return Object.freeze({
    selectMove: async (request, signal) => {
      requireStandardPosition(request)
      const random = createDeterministicRandom(
        await deriveOpponentPositionSeed(
          cryptography,
          matchSeed,
          request,
          signal,
        ),
      )
      const legalMoves = Object.freeze(
        [...request.legalMoves].sort(compareLegalMovesByUci),
      )
      const source = selectOpponentMoveSource(
        random,
        STANDARD_CHICKEN_RANDOM_MOVE_BASIS_POINTS,
      )

      if (source === "uniform-random-legal") {
        return selectUniformRandomLegalMove(random, legalMoves).id
      }

      const result = await session.search(
        {
          nodeLimit: STANDARD_CHICKEN_NODE_LIMIT,
          position: {
            fen: request.initialPosition.fen,
            moves: request.acceptedMoves.map((move) => move.uci),
          },
          requestId: request.requestId,
        },
        signal,
      )
      if (result.requestId !== request.requestId) {
        throw new Error("Stockfish returned a stale opponent response.")
      }

      const selectedMove = legalMoves.find(
        (move) => move.uci === result.bestMove,
      )
      if (selectedMove === undefined) {
        throw new Error("Stockfish returned no canonical legal move.")
      }

      return selectedMove.id
    },
  })
}

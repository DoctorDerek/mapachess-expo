import type {
  MatchOpponent,
  MatchOpponentRequest,
} from "@mapachess/match/match-machine"
import type { LegalMatchMove } from "@mapachess/match/match-move"
import type {
  MatchColor,
  MatchStartingPosition,
} from "@mapachess/match/match-position"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import {
  createDeterministicRandom,
  deriveOpponentPositionSeed,
  OPPONENT_POSITION_SEED_DERIVATION_VERSION,
  parseDeterministicRandomSeed,
  selectOpponentMoveSource,
  selectUniformRandomLegalMove,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"
import {
  STOCKFISH_18_WEB_SOURCE_REVISION,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "@mapachess/stockfish/web-runtime-identity"

export const CHICKEN_NODE_LIMIT = 10_000 as const
export const CHICKEN_RANDOM_MOVE_BASIS_POINTS = 8_000 as const
export const CHICKEN_PROVISIONAL_TARGET_ELO = 100 as const
export const CHICKEN_WEB_SEED_DERIVATION_VERSION =
  OPPONENT_POSITION_SEED_DERIVATION_VERSION
export const STANDARD_CHICKEN_WEB_POLICY_VERSION =
  "mapachess-standard-chicken-web-policy/v1" as const
const CHICKEN_WEB_POLICY_ENGINE_FINGERPRINT = [
  `stockfish-js-source/${STOCKFISH_18_WEB_SOURCE_REVISION}`,
  `wasm-sha256/${STOCKFISH_18_WEB_WASM_ARTIFACT.sha256}`,
  `nodes/${String(CHICKEN_NODE_LIMIT)}`,
  `random-basis-points/${String(CHICKEN_RANDOM_MOVE_BASIS_POINTS)}`,
  CHICKEN_WEB_SEED_DERIVATION_VERSION,
].join("|")

export function chickenPolicyFingerprint(variant: MatchVariant): string {
  const version =
    variant === "standard"
      ? STANDARD_CHICKEN_WEB_POLICY_VERSION
      : "mapachess-chess960-chicken-web-policy/v1"
  return `${version}|${CHICKEN_WEB_POLICY_ENGINE_FINGERPRINT}`
}

export const STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT =
  chickenPolicyFingerprint("standard")

export type ChickenCryptography = Readonly<{
  getRandomValues: Crypto["getRandomValues"]
  subtle: Pick<SubtleCrypto, "digest">
}>

const throwIfSelectionAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new StockfishOperationAbortedError("opponent move selection")
  }
}

const compareLegalMovesByUci = (
  left: LegalMatchMove,
  right: LegalMatchMove,
): number => (left.uci < right.uci ? -1 : left.uci > right.uci ? 1 : 0)

export function generateChickenMatchSeed(
  cryptography: ChickenCryptography,
): DeterministicRandomSeed {
  const words = cryptography.getRandomValues(new Uint32Array(4))
  const seed = [...words]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")

  return parseDeterministicRandomSeed(seed, "Chicken match seed")
}

export function selectStoryPlayerColor(
  matchSeed: DeterministicRandomSeed,
): "black" | "white" {
  const random = createDeterministicRandom(matchSeed)
  return random.nextIndex(2) === 0 ? "white" : "black"
}

export function chickenMatchId(
  matchSeed: DeterministicRandomSeed,
  startingPosition: MatchStartingPosition = {
    variant: "standard",
    chess960PositionId: null,
  },
  selection:
    | Readonly<{ mode: "story" }>
    | Readonly<{ mode: "challenge"; playerColor: MatchColor }> = {
    mode: "story",
  },
): string {
  if (selection.mode === "challenge") {
    return startingPosition.variant === "standard"
      ? `standard-challenge-chicken/${selection.playerColor}/${matchSeed}`
      : `chess960-challenge-chicken/${String(startingPosition.chess960PositionId)}/${selection.playerColor}/${matchSeed}`
  }
  return startingPosition.variant === "standard"
    ? `standard-story-chicken/${matchSeed}`
    : `chess960-story-chicken/${String(startingPosition.chess960PositionId)}/${matchSeed}`
}

const requireVariantPosition = (
  request: MatchOpponentRequest,
  variant: MatchVariant,
): void => {
  if (
    request.initialPosition.variant !== variant ||
    request.position.variant !== variant
  ) {
    throw new TypeError("Chicken received a position for a different variant.")
  }
}

export default function createChickenOpponent(
  session: StockfishEngineSession,
  cryptography: ChickenCryptography,
  matchSeed: DeterministicRandomSeed,
  variant: MatchVariant = "standard",
): MatchOpponent {
  return Object.freeze({
    selectMove: async (request, signal) => {
      requireVariantPosition(request, variant)
      throwIfSelectionAborted(signal)
      const random = createDeterministicRandom(
        await deriveOpponentPositionSeed(
          matchSeed,
          request.requestId,
          (bytes) => cryptography.subtle.digest("SHA-256", bytes),
        ),
      )
      throwIfSelectionAborted(signal)
      const legalMoves = Object.freeze(
        [...request.legalMoves].sort(compareLegalMovesByUci),
      )
      const source = selectOpponentMoveSource(
        random,
        CHICKEN_RANDOM_MOVE_BASIS_POINTS,
      )

      if (source === "uniform-random-legal") {
        return selectUniformRandomLegalMove(random, legalMoves).id
      }

      const result = await session.search(
        {
          nodeLimit: CHICKEN_NODE_LIMIT,
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

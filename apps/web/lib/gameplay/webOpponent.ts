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
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import {
  createDeterministicRandom,
  deriveOpponentPositionSeed,
  parseDeterministicRandomSeed,
  selectOpponentMoveSource,
  selectUniformRandomLegalMove,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"
import type { WebOpponentPolicy } from "./webOpponentPolicy"

export type WebOpponentCryptography = Readonly<{
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

export function generateWebMatchSeed(
  cryptography: WebOpponentCryptography,
): DeterministicRandomSeed {
  const words = cryptography.getRandomValues(new Uint32Array(4))
  const seed = [...words]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")

  return parseDeterministicRandomSeed(seed, "Web match seed")
}

export function selectStoryPlayerColor(
  matchSeed: DeterministicRandomSeed,
): "black" | "white" {
  const random = createDeterministicRandom(matchSeed)
  return random.nextIndex(2) === 0 ? "white" : "black"
}

export function webMatchId(
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
  opponentId: StockfishOpponentId = "chicken-stockfish",
): string {
  const animalId = opponentId.replace(/-stockfish$/, "")
  if (selection.mode === "challenge") {
    return startingPosition.variant === "standard"
      ? `standard-challenge-${animalId}/${selection.playerColor}/${matchSeed}`
      : `chess960-challenge-${animalId}/${String(startingPosition.chess960PositionId)}/${selection.playerColor}/${matchSeed}`
  }
  return startingPosition.variant === "standard"
    ? `standard-story-${animalId}/${matchSeed}`
    : `chess960-story-${animalId}/${String(startingPosition.chess960PositionId)}/${matchSeed}`
}

const requireVariantPosition = (
  request: MatchOpponentRequest,
  variant: MatchVariant,
): void => {
  if (
    request.initialPosition.variant !== variant ||
    request.position.variant !== variant
  ) {
    throw new TypeError("Opponent received a position for a different variant.")
  }
}

export default function createWebOpponent(
  session: StockfishEngineSession,
  cryptography: WebOpponentCryptography,
  matchSeed: DeterministicRandomSeed,
  policy: WebOpponentPolicy,
): MatchOpponent {
  return Object.freeze({
    selectMove: async (request, signal) => {
      requireVariantPosition(request, policy.variant)
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
        policy.randomMoveProbabilityBasisPoints,
      )

      if (source === "uniform-random-legal") {
        return selectUniformRandomLegalMove(random, legalMoves).id
      }

      const result = await session.search(
        {
          nodeLimit: policy.nodeLimit,
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

import type {
  MatchOpponent,
  MatchOpponentRequest,
} from "@mapachess/match/match-machine"
import type { LegalMatchMove } from "@mapachess/match/match-move"
import type { MatchVariant } from "@mapachess/match/match-variant"
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
  type OpponentSeedDigest,
} from "@mapachess/stockfish/opponent-move-selection"

export type OpponentSearchPolicy = Readonly<{
  nodeLimit: number
  randomMoveProbabilityBasisPoints: number
  variant: MatchVariant
}>

export function generateMatchSeed(
  fillRandomWords: (
    words: Uint32Array<ArrayBuffer>,
  ) => Uint32Array<ArrayBuffer>,
): DeterministicRandomSeed {
  const words = fillRandomWords(new Uint32Array(4))
  const seed = [...words]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")
  return parseDeterministicRandomSeed(seed, "match seed")
}

const throwIfSelectionAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new StockfishOperationAbortedError("opponent move selection")
  }
}

const compareLegalMovesByUci = (
  left: LegalMatchMove,
  right: LegalMatchMove,
): number => (left.uci < right.uci ? -1 : left.uci > right.uci ? 1 : 0)

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

export default function createMatchOpponent(
  session: StockfishEngineSession,
  digest: OpponentSeedDigest,
  matchSeed: DeterministicRandomSeed,
  policy: OpponentSearchPolicy,
): MatchOpponent {
  return Object.freeze<MatchOpponent>({
    selectMove: async (request, signal) => {
      requireVariantPosition(request, policy.variant)
      throwIfSelectionAborted(signal)
      const random = createDeterministicRandom(
        await deriveOpponentPositionSeed(matchSeed, request.requestId, digest),
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

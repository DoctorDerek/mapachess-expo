import type { MatchPosition } from "@mapachess/match/match-position"
import type {
  StockfishEngineSearchResult,
  StockfishEngineSession,
  StockfishScore,
} from "@mapachess/stockfish/engine-session"
import {
  normalizeStockfishPositionEvaluation,
  terminalPositionEvaluation,
  type PositionEvaluation,
} from "./positionEvaluation.js"

export const POSITION_EVALUATION_NODE_LIMIT = 10_000 as const

export type PositionEvaluationRequest = Readonly<{
  position: MatchPosition
  requestId: string
}>

export type PositionEvaluationResult = Readonly<{
  evaluation: PositionEvaluation
  positionFen: string
  requestId: string
}>

export type PositionEvaluator = (
  request: PositionEvaluationRequest,
  signal: AbortSignal,
) => Promise<PositionEvaluationResult>

const requireFinalScore = (
  result: StockfishEngineSearchResult,
): StockfishScore => {
  const rankOneScore = result.principalVariations?.find(
    (variation) => variation.rank === 1,
  )?.score
  const score = rankOneScore ?? result.latestInformation?.score

  if (score === undefined) {
    throw new Error("Stockfish completed position evaluation without a score.")
  }

  return score
}

export const evaluatePositionWithStockfish = async (
  session: StockfishEngineSession,
  request: PositionEvaluationRequest,
  signal: AbortSignal,
): Promise<PositionEvaluationResult> => {
  const terminalEvaluation = terminalPositionEvaluation(request.position)
  if (terminalEvaluation !== undefined) {
    return Object.freeze({
      evaluation: terminalEvaluation,
      positionFen: request.position.fen,
      requestId: request.requestId,
    })
  }

  const result = await session.search(
    {
      nodeLimit: POSITION_EVALUATION_NODE_LIMIT,
      position: Object.freeze({ fen: request.position.fen, moves: [] }),
      requestId: request.requestId,
    },
    signal,
  )

  if (result.requestId !== request.requestId) {
    throw new Error(
      `Rejected stale position evaluation response ${result.requestId}.`,
    )
  }

  return Object.freeze({
    evaluation: normalizeStockfishPositionEvaluation(
      request.position.turn,
      requireFinalScore(result),
    ),
    positionFen: request.position.fen,
    requestId: request.requestId,
  })
}

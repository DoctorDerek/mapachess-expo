import type { BetterHintsRequest, BetterHintsResult } from "../src/betterHints"
import {
  parseChess960PositionId,
  type Chess960PositionId,
} from "../src/chess960Position"
import {
  applyMatchMove,
  listLegalMatchMoves,
  type LegalMatchMove,
  type MatchMoveTransition,
} from "../src/matchMove"
import type { MatchPosition } from "../src/matchPosition"

export const requireChess960PositionId = (
  value: number,
): Chess960PositionId => {
  const result = parseChess960PositionId(value)
  if (!result.ok) {
    throw new Error(`Invalid Chess960 test position ${value}`)
  }
  return result.positionId
}

export const requireLegalMove = (
  position: MatchPosition,
  uci: string,
): LegalMatchMove => {
  const move = listLegalMatchMoves(position).find(
    (legalMove) => legalMove.uci === uci,
  )
  if (!move) {
    throw new Error(`Missing legal test move ${uci} from ${position.fen}`)
  }
  return move
}

export const requireAppliedMove = (
  position: MatchPosition,
  uci: string,
): MatchMoveTransition => {
  const result = applyMatchMove(position, requireLegalMove(position, uci).id)
  if (!result.ok) {
    throw new Error(`Could not apply legal test move ${uci}`)
  }
  return result.transition
}

export const createHintResult = (
  request: BetterHintsRequest,
): BetterHintsResult =>
  Object.freeze({
    opponent: Object.freeze([
      Object.freeze({
        color: "black" as const,
        from: "e7" as const,
        to: "e5" as const,
        uci: "e7e5",
      }),
      Object.freeze({
        color: "black" as const,
        from: "g8" as const,
        to: "f6" as const,
        uci: "g8f6",
      }),
      Object.freeze({
        color: "black" as const,
        from: "d7" as const,
        to: "d5" as const,
        uci: "d7d5",
      }),
    ]),
    player: Object.freeze([
      Object.freeze({
        color: "white" as const,
        from: "e2" as const,
        to: "e4" as const,
        uci: "e2e4",
      }),
      Object.freeze({
        color: "white" as const,
        from: "g1" as const,
        to: "f3" as const,
        uci: "g1f3",
      }),
      Object.freeze({
        color: "white" as const,
        from: "d2" as const,
        to: "d4" as const,
        uci: "d2d4",
      }),
    ]),
    positionFen: request.position.fen,
    requestId: request.requestId,
  })

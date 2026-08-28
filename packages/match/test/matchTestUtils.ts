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

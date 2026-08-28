import { castlingSide, Chess } from "chessops/chess"
import { makeFen, parseFen } from "chessops/fen"
import { makeSan } from "chessops/san"
import type { NormalMove, Move as RulesMove } from "chessops/types"
import {
  kingCastlesTo,
  makeSquare,
  makeUci,
  parseUci,
  rookCastlesTo,
  squareRank,
} from "chessops/util"
import {
  reconstructMatchPosition,
  type MatchColor,
  type MatchPosition,
  type MatchSquare,
  type MatchStartingPosition,
} from "./matchPosition.js"

export const MATCH_PROMOTION_ROLES = [
  "queen",
  "rook",
  "bishop",
  "knight",
] as const

export type MatchPromotionRole = (typeof MATCH_PROMOTION_ROLES)[number]

declare const matchMoveIdBrand: unique symbol

export type MatchMoveId = string & { readonly [matchMoveIdBrand]: true }

type LegalMatchMoveBase = Readonly<{
  id: MatchMoveId
  san: string
  uci: string
}>

export type LegalMatchMove =
  | (LegalMatchMoveBase &
      Readonly<{
        from: MatchSquare
        kind: "normal"
        promotion: MatchPromotionRole | null
        to: MatchSquare
      }>)
  | (LegalMatchMoveBase &
      Readonly<{
        from: MatchSquare
        kind: "castle"
        rookFrom: MatchSquare
        rookTo: MatchSquare
        side: "king" | "queen"
        to: MatchSquare
      }>)

export type AppliedMatchMove = LegalMatchMove &
  Readonly<{
    afterFen: string
    beforeFen: string
  }>

export type MatchMoveTransition = Readonly<{
  after: MatchPosition
  before: MatchPosition
  move: AppliedMatchMove
}>

export type MatchMoveApplicationResult =
  | Readonly<{
      ok: true
      transition: MatchMoveTransition
    }>
  | Readonly<{
      error: Readonly<{
        moveId: string
        type: "MATCH.MOVE_ILLEGAL"
      }>
      ok: false
    }>

const createRulesPosition = (position: MatchPosition): Chess => {
  const setupResult = parseFen(position.fen)
  if (setupResult.isErr) {
    throw new Error("Canonical match position contains invalid FEN")
  }

  const positionResult = Chess.fromSetup(setupResult.value)
  if (positionResult.isErr) {
    throw new Error("Canonical match position cannot reconstruct chess rules")
  }
  return positionResult.value
}

const matchStartingPosition = (
  position: MatchPosition,
): MatchStartingPosition =>
  position.variant === "standard"
    ? { chess960PositionId: null, variant: "standard" }
    : {
        chess960PositionId: position.chess960PositionId,
        variant: "chess960",
      }

const isPromotionDestination = (position: Chess, move: NormalMove): boolean => {
  const role = position.board.getRole(move.from)
  const destinationRank = squareRank(move.to)
  return role === "pawn" && (destinationRank === 0 || destinationRank === 7)
}

const createNormalLegalMove = (
  position: Chess,
  move: NormalMove,
): LegalMatchMove => {
  const id = makeUci(move) as MatchMoveId
  return Object.freeze({
    from: makeSquare(move.from) as MatchSquare,
    id,
    kind: "normal",
    promotion: (move.promotion as MatchPromotionRole | undefined) ?? null,
    san: makeSan(position, move),
    to: makeSquare(move.to) as MatchSquare,
    uci: id,
  })
}

const createCastlingLegalMove = (
  matchPosition: MatchPosition,
  position: Chess,
  move: NormalMove,
  side: "a" | "h",
): LegalMatchMove => {
  const color: MatchColor = position.turn
  const rookFrom = position.castles.rook[color][side]
  if (rookFrom === undefined) {
    throw new Error("Legal castling move is missing its rook")
  }

  const kingTo = kingCastlesTo(color, side)
  const internalUci = makeUci(move)
  const engineUci =
    matchPosition.variant === "standard"
      ? makeSquare(move.from) + makeSquare(kingTo)
      : internalUci

  return Object.freeze({
    from: makeSquare(move.from) as MatchSquare,
    id: internalUci as MatchMoveId,
    kind: "castle",
    rookFrom: makeSquare(rookFrom) as MatchSquare,
    rookTo: makeSquare(rookCastlesTo(color, side)) as MatchSquare,
    san: makeSan(position, move),
    side: side === "a" ? "queen" : "king",
    to: makeSquare(kingTo) as MatchSquare,
    uci: engineUci,
  })
}

const createLegalMatchMove = (
  matchPosition: MatchPosition,
  position: Chess,
  move: NormalMove,
): LegalMatchMove => {
  const side = castlingSide(position, move)
  return side
    ? createCastlingLegalMove(matchPosition, position, move, side)
    : createNormalLegalMove(position, move)
}

export const listLegalMatchMoves = (
  matchPosition: MatchPosition,
): readonly LegalMatchMove[] => {
  const position = createRulesPosition(matchPosition)
  const legalMoves: LegalMatchMove[] = []

  for (const [from, destinations] of position.allDests()) {
    for (const to of destinations) {
      const move: NormalMove = { from, to }
      if (isPromotionDestination(position, move)) {
        for (const promotion of MATCH_PROMOTION_ROLES) {
          legalMoves.push(
            createLegalMatchMove(matchPosition, position, {
              ...move,
              promotion,
            }),
          )
        }
      } else {
        legalMoves.push(createLegalMatchMove(matchPosition, position, move))
      }
    }
  }

  return Object.freeze(legalMoves)
}

export const applyMatchMove = (
  position: MatchPosition,
  moveId: MatchMoveId,
): MatchMoveApplicationResult => {
  const legalMove = listLegalMatchMoves(position).find(
    (move) => move.id === moveId,
  )
  const rulesMove: RulesMove | undefined = parseUci(moveId)
  if (!legalMove || !rulesMove) {
    return {
      error: { moveId, type: "MATCH.MOVE_ILLEGAL" },
      ok: false,
    }
  }

  const rulesPosition = createRulesPosition(position)
  if (!rulesPosition.isLegal(rulesMove)) {
    return {
      error: { moveId, type: "MATCH.MOVE_ILLEGAL" },
      ok: false,
    }
  }

  rulesPosition.play(rulesMove)
  const afterResult = reconstructMatchPosition(
    matchStartingPosition(position),
    makeFen(rulesPosition.toSetup()),
  )
  if (!afterResult.ok) {
    throw new Error("Legal move produced an invalid canonical position")
  }

  const appliedMove = Object.freeze({
    ...legalMove,
    afterFen: afterResult.position.fen,
    beforeFen: position.fen,
  })
  return {
    ok: true,
    transition: Object.freeze({
      after: afterResult.position,
      before: position,
      move: appliedMove,
    }),
  }
}

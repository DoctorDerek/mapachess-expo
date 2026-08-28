import { Chess } from "chessops/chess"
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen"
import { makeSquare } from "chessops/util"
import {
  createChess960InitialFen,
  type Chess960PositionId,
} from "./chess960Position.js"

export const MATCH_COLORS = ["white", "black"] as const
export const MATCH_PIECE_ROLES = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
] as const

export type MatchColor = (typeof MATCH_COLORS)[number]
export type MatchPieceRole = (typeof MATCH_PIECE_ROLES)[number]
export type MatchSquare = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${
  "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"}`

export type MatchStartingPosition =
  | Readonly<{
      chess960PositionId: null
      variant: "standard"
    }>
  | Readonly<{
      chess960PositionId: Chess960PositionId
      variant: "chess960"
    }>

export type MatchPositionStatus =
  | Readonly<{ type: "playing" }>
  | Readonly<{ type: "stalemate" }>
  | Readonly<{ type: "insufficient-material" }>
  | Readonly<{
      type: "checkmate"
      winner: MatchColor
    }>

export type MatchBoardPiece = Readonly<{
  color: MatchColor
  role: MatchPieceRole
  square: MatchSquare
}>

type MatchPositionBase = Readonly<{
  fen: string
  inCheck: boolean
  pieces: readonly MatchBoardPiece[]
  status: MatchPositionStatus
  turn: MatchColor
}>

export type MatchPosition =
  | (MatchPositionBase &
      Readonly<{
        chess960PositionId: null
        variant: "standard"
      }>)
  | (MatchPositionBase &
      Readonly<{
        chess960PositionId: Chess960PositionId
        variant: "chess960"
      }>)

export type MatchPositionReconstructionResult =
  | Readonly<{
      ok: true
      position: MatchPosition
    }>
  | Readonly<{
      error: Readonly<{
        fen: string
        type: "MATCH.FEN_INVALID" | "MATCH.POSITION_INVALID"
      }>
      ok: false
    }>

const oppositeColor = (color: MatchColor): MatchColor =>
  color === "white" ? "black" : "white"

const derivePositionStatus = (position: Chess): MatchPositionStatus => {
  if (position.isCheckmate()) {
    return Object.freeze({
      type: "checkmate",
      winner: oppositeColor(position.turn),
    })
  }
  if (position.isStalemate()) {
    return Object.freeze({ type: "stalemate" })
  }
  if (position.isInsufficientMaterial()) {
    return Object.freeze({ type: "insufficient-material" })
  }
  return Object.freeze({ type: "playing" })
}

const createMatchPosition = (
  startingPosition: MatchStartingPosition,
  position: Chess,
): MatchPosition => {
  const pieces = Object.freeze(
    [...position.board].map(([square, piece]) =>
      Object.freeze({
        color: piece.color,
        role: piece.role,
        square: makeSquare(square) as MatchSquare,
      }),
    ),
  )
  const sharedPosition = {
    fen: makeFen(position.toSetup()),
    inCheck: position.isCheck(),
    pieces,
    status: derivePositionStatus(position),
    turn: position.turn,
  }

  return startingPosition.variant === "standard"
    ? Object.freeze({
        ...sharedPosition,
        chess960PositionId: null,
        variant: "standard",
      })
    : Object.freeze({
        ...sharedPosition,
        chess960PositionId: startingPosition.chess960PositionId,
        variant: "chess960",
      })
}

export const reconstructMatchPosition = (
  startingPosition: MatchStartingPosition,
  fen: string,
): MatchPositionReconstructionResult => {
  const setupResult = parseFen(fen)
  if (setupResult.isErr) {
    return {
      error: { fen, type: "MATCH.FEN_INVALID" },
      ok: false,
    }
  }

  const positionResult = Chess.fromSetup(setupResult.value)
  if (positionResult.isErr) {
    return {
      error: { fen, type: "MATCH.POSITION_INVALID" },
      ok: false,
    }
  }

  return {
    ok: true,
    position: createMatchPosition(startingPosition, positionResult.value),
  }
}

export const createInitialMatchPosition = (
  startingPosition: MatchStartingPosition,
): MatchPosition => {
  const initialFen =
    startingPosition.variant === "standard"
      ? INITIAL_FEN
      : createChess960InitialFen(startingPosition.chess960PositionId)
  const result = reconstructMatchPosition(startingPosition, initialFen)
  if (!result.ok) {
    throw new Error("Canonical initial match position is invalid")
  }
  return result.position
}

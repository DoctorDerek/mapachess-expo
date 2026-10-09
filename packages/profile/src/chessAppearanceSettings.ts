import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
  type ChessBoardId,
  type ChessPieceSetId,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import {
  failData,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"

export type ChessAppearanceSettings = Readonly<{
  boardId: ChessBoardId
  pieceSetId: ChessPieceSetId
}>

export type ChessAppearanceChange =
  | Readonly<{ boardId: ChessBoardId; pieceSetId?: never }>
  | Readonly<{ pieceSetId: ChessPieceSetId; boardId?: never }>

export const DEFAULT_CHESS_APPEARANCE: ChessAppearanceSettings = Object.freeze({
  boardId: "current",
  pieceSetId: "current",
})

export const sameChessAppearance = (
  left: ChessAppearanceSettings,
  right: ChessAppearanceSettings,
): boolean =>
  left.boardId === right.boardId && left.pieceSetId === right.pieceSetId

export default function decodeChessAppearance(
  received: unknown,
  path = "$.settings.chessAppearance",
): ChessAppearanceSettings {
  const object = requireObject(received, path)
  requireExactKeys(object, ["boardId", "pieceSetId"], path)
  const board = CHESS_BOARDS.find(({ id }) => id === object.boardId)
  const pieces = CHESS_PIECE_SETS.find(({ id }) => id === object.pieceSetId)
  if (board === undefined) return failData(`${path}.boardId`)
  if (pieces === undefined) return failData(`${path}.pieceSetId`)
  return Object.freeze({ boardId: board.id, pieceSetId: pieces.id })
}

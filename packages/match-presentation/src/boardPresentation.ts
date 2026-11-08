import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type { LegalMatchMove } from "@mapachess/match/match-move"
import type {
  MatchBoardPiece,
  MatchColor,
  MatchSquare,
} from "@mapachess/match/match-position"

export const BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const
export const BOARD_RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const

export type BoardOrientation = MatchColor
export type BoardNavigationKey =
  "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "End" | "Home"

export const boardDestinationMoves = (
  moves: readonly LegalMatchMove[],
  square: MatchSquare,
): readonly LegalMatchMove[] =>
  moves.filter(
    (move) =>
      move.to === square ||
      (move.kind === "castle" && move.rookFrom === square),
  )

export function hintDescriptionsForSquare(
  hints: BetterHintsResult | null,
  showMoveHints: boolean,
  square: MatchSquare,
  copy: MapachessCatalog["board"],
): readonly string[] {
  if (hints === null) return []
  const descriptions: string[] = []
  for (const owner of ["player", "opponent"] as const) {
    if (hints[owner].some((hint) => hint.from === square))
      descriptions.push(copy.pieceHint(owner))
    if (showMoveHints)
      descriptions.push(
        ...hints[owner]
          .filter((hint) => hint.to === square)
          .map((hint) =>
            hint.castling === undefined
              ? copy.moveHint(owner, hint.from)
              : copy.castleHint(
                  owner,
                  hint.castling.side,
                  hint.to,
                  hint.castling.rookFrom,
                  hint.castling.rookTo,
                ),
          ),
      )
  }
  return descriptions
}

const reverse = <Value>(values: readonly Value[]): readonly Value[] =>
  Object.freeze([...values].reverse())

export function createBoardSquareRows(
  orientation: BoardOrientation,
): readonly (readonly MatchSquare[])[] {
  const files = orientation === "white" ? BOARD_FILES : reverse(BOARD_FILES)
  const ranks = orientation === "white" ? reverse(BOARD_RANKS) : BOARD_RANKS

  return Object.freeze(
    ranks.map((rank) =>
      Object.freeze(files.map((file) => `${file}${rank}` as MatchSquare)),
    ),
  )
}

const clampBoardIndex = (value: number): number =>
  Math.min(BOARD_FILES.length - 1, Math.max(0, value))

export function cycleOwnPieceFocus(
  rows: readonly (readonly MatchSquare[])[],
  pieces: readonly MatchBoardPiece[],
  color: BoardOrientation,
  current: MatchSquare,
  direction: "previousPiece" | "nextPiece",
): MatchSquare {
  const board = rows.flat()
  const own = board.filter((square) =>
    pieces.some((piece) => piece.square === square && piece.color === color),
  )
  const index = board.indexOf(current)
  return direction === "nextPiece"
    ? (own.find((square) => board.indexOf(square) > index) ?? own[0] ?? current)
    : (own.findLast((square) => board.indexOf(square) < index) ??
        own.at(-1) ??
        current)
}

export function nextFocusedBoardSquare(
  rows: readonly (readonly MatchSquare[])[],
  currentSquare: MatchSquare,
  key: BoardNavigationKey,
): MatchSquare {
  const rowIndex = rows.findIndex((row) => row.includes(currentSquare))
  const columnIndex = rows[rowIndex]?.indexOf(currentSquare) ?? -1
  if (rowIndex < 0 || columnIndex < 0) {
    throw new RangeError("Focused square is absent from the displayed board.")
  }

  const nextRowIndex = clampBoardIndex(
    rowIndex + (key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0),
  )
  const nextColumnIndex =
    key === "Home"
      ? 0
      : key === "End"
        ? BOARD_FILES.length - 1
        : clampBoardIndex(
            columnIndex +
              (key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0),
          )
  const nextSquare = rows[nextRowIndex]?.[nextColumnIndex]
  if (nextSquare === undefined) {
    throw new RangeError("Board navigation produced an invalid square.")
  }

  return nextSquare
}

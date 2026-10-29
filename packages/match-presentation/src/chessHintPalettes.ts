import type { ChessBoardId } from "./chessAppearanceCatalog.js"

export type ChessHintPalette = Readonly<{
  player: string
  opponent: string
}>

const LIGHT_BOARD_HINTS = Object.freeze({
  player: "#007735",
  opponent: "#b51c35",
}) satisfies ChessHintPalette

const DARK_BOARD_HINTS = Object.freeze({
  player: "#58f093",
  opponent: "#ff8978",
}) satisfies ChessHintPalette

const MIXED_BOARD_HINTS = Object.freeze({
  player: "#33d97c",
  opponent: "#ff776b",
}) satisfies ChessHintPalette

const CHESS_HINT_PALETTES = Object.freeze({
  current: LIGHT_BOARD_HINTS,
  "toffee-brown": MIXED_BOARD_HINTS,
  "toffee-mono": DARK_BOARD_HINTS,
  "toffee-green": MIXED_BOARD_HINTS,
  "toffee-wood": MIXED_BOARD_HINTS,
  "toffee-ice": LIGHT_BOARD_HINTS,
  "back-a": MIXED_BOARD_HINTS,
  "back-b": DARK_BOARD_HINTS,
  "back-c": DARK_BOARD_HINTS,
  "back-d": DARK_BOARD_HINTS,
  "back-e": DARK_BOARD_HINTS,
  "back-f": MIXED_BOARD_HINTS,
  "back-g": MIXED_BOARD_HINTS,
  "back-h": DARK_BOARD_HINTS,
  "back-i": DARK_BOARD_HINTS,
  cosunosuke: DARK_BOARD_HINTS,
  "cat-chess": LIGHT_BOARD_HINTS,
}) satisfies Readonly<Record<ChessBoardId, ChessHintPalette>>

export default CHESS_HINT_PALETTES

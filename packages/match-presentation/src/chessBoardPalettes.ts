import type { ChessBoardId } from "./chessAppearanceCatalog.js"

export type ChessHintPalette = Readonly<{
  player: string
  opponent: string
  outline: string
}>

export type ChessBoardPalette = Readonly<{
  hints: ChessHintPalette
  history: Readonly<{ origin: string; destination: string }>
}>

const LIGHT_HISTORY = Object.freeze({
  origin: "#d7b7f0",
  destination: "#a56dd5",
})
const DARK_HISTORY = Object.freeze({
  origin: "#766387",
  destination: "#ac82d4",
})
const createPalette = (
  player: string,
  history: ChessBoardPalette["history"],
): ChessBoardPalette =>
  Object.freeze({
    hints: Object.freeze({ player, opponent: "#ffd700", outline: "#14273d" }),
    history,
  })

const BLUE_BOARD = createPalette("#003cfa", LIGHT_HISTORY)
const LIGHT_BOARD = createPalette("#0066ff", LIGHT_HISTORY)
const DARK_BOARD = createPalette("#2996ff", DARK_HISTORY)
const MIXED_BOARD = createPalette("#0074ff", LIGHT_HISTORY)

const CHESS_BOARD_PALETTES = Object.freeze({
  current: BLUE_BOARD,
  "toffee-brown": MIXED_BOARD,
  "toffee-mono": DARK_BOARD,
  "toffee-green": MIXED_BOARD,
  "toffee-wood": MIXED_BOARD,
  "toffee-ice": LIGHT_BOARD,
  "back-a": MIXED_BOARD,
  "back-b": DARK_BOARD,
  "back-c": DARK_BOARD,
  "back-d": DARK_BOARD,
  "back-e": DARK_BOARD,
  "back-f": MIXED_BOARD,
  "back-g": MIXED_BOARD,
  "back-h": DARK_BOARD,
  "back-i": DARK_BOARD,
  cosunosuke: DARK_BOARD,
  "cat-chess": LIGHT_BOARD,
}) satisfies Readonly<Record<ChessBoardId, ChessBoardPalette>>

export default CHESS_BOARD_PALETTES

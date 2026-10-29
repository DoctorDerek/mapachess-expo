import type { ChessBoardId } from "./chessAppearanceCatalog.js"

export const CHESS_BOARD_PALETTE_IDS = [
  "blue",
  "light",
  "dark",
  "textured",
] as const

export type ChessBoardPalette = (typeof CHESS_BOARD_PALETTE_IDS)[number]

const CHESS_BOARD_PALETTES = Object.freeze({
  current: "blue",
  "toffee-brown": "textured",
  "toffee-mono": "dark",
  "toffee-green": "textured",
  "toffee-wood": "textured",
  "toffee-ice": "light",
  "back-a": "textured",
  "back-b": "dark",
  "back-c": "dark",
  "back-d": "dark",
  "back-e": "dark",
  "back-f": "textured",
  "back-g": "textured",
  "back-h": "dark",
  "back-i": "dark",
  cosunosuke: "dark",
  "cat-chess": "light",
}) satisfies Readonly<Record<ChessBoardId, ChessBoardPalette>>

export default CHESS_BOARD_PALETTES

import { describe, expect, it } from "vitest"
import { CHESS_BOARDS } from "../src/chessAppearanceCatalog.js"
import CHESS_BOARD_PALETTES, {
  CHESS_BOARD_PALETTE_IDS,
} from "../src/chessBoardPalettes.js"

describe("board annotation contrast families", () => {
  it("covers every board with the bounded immutable family catalog", () => {
    expect(Object.keys(CHESS_BOARD_PALETTES).sort()).toEqual(
      CHESS_BOARDS.map(({ id }) => id).sort(),
    )
    expect(Object.isFrozen(CHESS_BOARD_PALETTES)).toBe(true)
    expect([...new Set(Object.values(CHESS_BOARD_PALETTES))].sort()).toEqual(
      [...CHESS_BOARD_PALETTE_IDS].sort(),
    )
  })

  it.each([
    ["current", "blue"],
    ["toffee-ice", "light"],
    ["cosunosuke", "dark"],
    ["toffee-wood", "textured"],
  ] as const)(
    "retains the approved contrast family for %s",
    (board, family) => {
      expect(CHESS_BOARD_PALETTES[board]).toBe(family)
    },
  )

  it("preserves the complete approved board grouping", () => {
    expect(CHESS_BOARD_PALETTES).toEqual({
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
    })
  })
})

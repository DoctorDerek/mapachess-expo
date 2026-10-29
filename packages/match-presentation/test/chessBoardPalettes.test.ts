import { describe, expect, it } from "vitest"
import { CHESS_BOARDS } from "../src/chessAppearanceCatalog.js"
import CHESS_BOARD_PALETTES from "../src/chessBoardPalettes.js"

describe("board-tuned annotation palettes", () => {
  it("covers every board with bounded immutable presets and stable hint ownership", () => {
    expect(Object.keys(CHESS_BOARD_PALETTES).sort()).toEqual(
      CHESS_BOARDS.map(({ id }) => id).sort(),
    )
    expect(Object.isFrozen(CHESS_BOARD_PALETTES)).toBe(true)
    expect(new Set(Object.values(CHESS_BOARD_PALETTES)).size).toBe(4)
    for (const palette of Object.values(CHESS_BOARD_PALETTES)) {
      expect(Object.isFrozen(palette)).toBe(true)
      expect(Object.isFrozen(palette.hints)).toBe(true)
      expect(Object.isFrozen(palette.history)).toBe(true)
      expect(palette.hints.opponent).toBe("#ffd700")
      expect(palette.hints.outline).toBe("#14273d")
      expect(palette.history.origin).not.toBe(palette.history.destination)
      for (const color of [
        ...Object.values(palette.hints),
        ...Object.values(palette.history),
      ])
        expect(color).toMatch(/^#[\da-f]{6}$/)
    }
  })

  it.each([
    ["current", "#003cfa"],
    ["toffee-ice", "#0066ff"],
    ["cosunosuke", "#2996ff"],
    ["toffee-wood", "#0074ff"],
  ] as const)("retains the approved Azure for %s", (board, player) => {
    expect(CHESS_BOARD_PALETTES[board].hints.player).toBe(player)
  })

  it("tunes violet history for dark boards without multiplying marker semantics", () => {
    expect(CHESS_BOARD_PALETTES.current.history).toEqual({
      origin: "#d7b7f0",
      destination: "#a56dd5",
    })
    expect(CHESS_BOARD_PALETTES.cosunosuke.history).toEqual({
      origin: "#766387",
      destination: "#ac82d4",
    })
    expect(CHESS_BOARD_PALETTES["toffee-wood"].history).toBe(
      CHESS_BOARD_PALETTES.current.history,
    )
    expect(CHESS_BOARD_PALETTES["cat-chess"]).toBe(
      CHESS_BOARD_PALETTES["toffee-ice"],
    )
  })
})

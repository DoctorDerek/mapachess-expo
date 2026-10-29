import { describe, expect, it } from "vitest"
import { CHESS_BOARDS } from "../src/chessAppearanceCatalog.js"
import CHESS_HINT_PALETTES from "../src/chessHintPalettes.js"

describe("board-tuned hint palettes", () => {
  it("covers every selectable board without mutable or duplicate palette definitions", () => {
    expect(Object.keys(CHESS_HINT_PALETTES).sort()).toEqual(
      CHESS_BOARDS.map(({ id }) => id).sort(),
    )
    expect(Object.isFrozen(CHESS_HINT_PALETTES)).toBe(true)
    expect(new Set(Object.values(CHESS_HINT_PALETTES)).size).toBe(3)
    for (const palette of Object.values(CHESS_HINT_PALETTES)) {
      expect(Object.isFrozen(palette)).toBe(true)
      expect(Object.keys(palette).sort()).toEqual(["opponent", "player"])
      expect(palette.player).toMatch(/^#[\da-f]{6}$/)
      expect(palette.opponent).toMatch(/^#[\da-f]{6}$/)
      expect(palette.player).not.toBe(palette.opponent)
    }
  })

  it("retains the approved light, dark and textured-board colors", () => {
    expect(CHESS_HINT_PALETTES["toffee-ice"]).toEqual({
      player: "#007735",
      opponent: "#b51c35",
    })
    expect(CHESS_HINT_PALETTES.cosunosuke).toEqual({
      player: "#58f093",
      opponent: "#ff8978",
    })
    expect(CHESS_HINT_PALETTES["toffee-wood"]).toEqual({
      player: "#33d97c",
      opponent: "#ff776b",
    })
  })

  it("uses light-board ink for the default fallback and the bright Cat Chess board", () => {
    expect(CHESS_HINT_PALETTES.current).toBe(CHESS_HINT_PALETTES["toffee-ice"])
    expect(CHESS_HINT_PALETTES["cat-chess"]).toBe(CHESS_HINT_PALETTES.current)
  })
})

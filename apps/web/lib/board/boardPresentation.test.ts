import { describe, expect, it } from "vitest"
import {
  createBoardSquareRows,
  nextFocusedBoardSquare,
} from "./boardPresentation"

describe("canonical board presentation", () => {
  it("orients every square with the player nearest the bottom", () => {
    const whiteRows = createBoardSquareRows("white")
    const blackRows = createBoardSquareRows("black")

    expect(whiteRows[0]).toEqual([
      "a8",
      "b8",
      "c8",
      "d8",
      "e8",
      "f8",
      "g8",
      "h8",
    ])
    expect(whiteRows[7]).toEqual([
      "a1",
      "b1",
      "c1",
      "d1",
      "e1",
      "f1",
      "g1",
      "h1",
    ])
    expect(blackRows[0]).toEqual([
      "h1",
      "g1",
      "f1",
      "e1",
      "d1",
      "c1",
      "b1",
      "a1",
    ])
    expect(blackRows[7]).toEqual([
      "h8",
      "g8",
      "f8",
      "e8",
      "d8",
      "c8",
      "b8",
      "a8",
    ])
  })

  it("moves focus in displayed directions and clamps every edge", () => {
    const rows = createBoardSquareRows("white")

    expect(nextFocusedBoardSquare(rows, "e4", "ArrowUp")).toBe("e5")
    expect(nextFocusedBoardSquare(rows, "e4", "ArrowDown")).toBe("e3")
    expect(nextFocusedBoardSquare(rows, "e4", "ArrowLeft")).toBe("d4")
    expect(nextFocusedBoardSquare(rows, "e4", "ArrowRight")).toBe("f4")
    expect(nextFocusedBoardSquare(rows, "a8", "ArrowUp")).toBe("a8")
    expect(nextFocusedBoardSquare(rows, "a8", "ArrowLeft")).toBe("a8")
    expect(nextFocusedBoardSquare(rows, "h1", "ArrowDown")).toBe("h1")
    expect(nextFocusedBoardSquare(rows, "h1", "ArrowRight")).toBe("h1")
    expect(nextFocusedBoardSquare(rows, "e4", "Home")).toBe("a4")
    expect(nextFocusedBoardSquare(rows, "e4", "End")).toBe("h4")
  })

  it("keeps directional navigation visual when Black is at the bottom", () => {
    const rows = createBoardSquareRows("black")

    expect(nextFocusedBoardSquare(rows, "e4", "ArrowUp")).toBe("e3")
    expect(nextFocusedBoardSquare(rows, "e4", "ArrowRight")).toBe("d4")
    expect(nextFocusedBoardSquare(rows, "e4", "Home")).toBe("h4")
    expect(nextFocusedBoardSquare(rows, "e4", "End")).toBe("a4")
  })

  it("fails loudly when focus is absent from the displayed board", () => {
    expect(() => nextFocusedBoardSquare([], "e4", "ArrowRight")).toThrow(
      "Focused square is absent",
    )
    expect(() =>
      nextFocusedBoardSquare([["e4"], []], "e4", "ArrowDown"),
    ).toThrow("Board navigation produced an invalid square")
  })
})

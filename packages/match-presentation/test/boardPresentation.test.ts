import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "@mapachess/match/match-position"
import {
  boardDestinationMoves,
  createBoardSquareRows,
  cycleOwnPieceFocus,
  hintDescriptionsForSquare,
  nextFocusedBoardSquare,
} from "../src/boardPresentation.js"

const start = { variant: "standard", chess960PositionId: null } as const

describe("shared board navigation and hint presentation", () => {
  it.each([
    {
      side: "white",
      first: "a8",
      left: "a8",
      right: "b8",
      down: "a7",
      end: "h8",
      last: "h1",
      ownFirst: "a2",
      ownLast: "h1",
    },
    {
      side: "black",
      first: "h1",
      left: "h1",
      right: "g1",
      down: "h2",
      end: "a1",
      last: "a8",
      ownFirst: "h7",
      ownLast: "a8",
    },
  ] as const)(
    "navigates and wraps only its own pieces with $side at the bottom",
    ({ side, first, left, right, down, end, last, ownFirst, ownLast }) => {
      const rows = createBoardSquareRows(side)
      const pieces = createInitialMatchPosition(start).pieces
      expect(rows.flat()).toHaveLength(64)
      expect(new Set(rows.flat()).size).toBe(64)
      expect(rows[0]?.[0]).toBe(first)
      expect(rows.at(-1)?.at(-1)).toBe(last)
      expect(nextFocusedBoardSquare(rows, first, "ArrowLeft")).toBe(left)
      expect(nextFocusedBoardSquare(rows, first, "ArrowRight")).toBe(right)
      expect(nextFocusedBoardSquare(rows, first, "ArrowDown")).toBe(down)
      expect(nextFocusedBoardSquare(rows, down, "ArrowUp")).toBe(first)
      expect(nextFocusedBoardSquare(rows, first, "End")).toBe(end)
      expect(nextFocusedBoardSquare(rows, end, "Home")).toBe(first)
      expect(cycleOwnPieceFocus(rows, pieces, side, ownLast, "nextPiece")).toBe(
        ownFirst,
      )
      expect(
        cycleOwnPieceFocus(rows, pieces, side, ownFirst, "previousPiece"),
      ).toBe(ownLast)
      expect(cycleOwnPieceFocus(rows, [], side, first, "previousPiece")).toBe(
        first,
      )
      expect(cycleOwnPieceFocus(rows, [], side, first, "nextPiece")).toBe(first)
    },
  )

  it("accepts either castling target and describes hints only at their disclosed stage", () => {
    const result = reconstructMatchPosition(
      start,
      "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    )
    if (!result.ok) throw new Error("Expected legal castling position")
    const kingMoves = listLegalMatchMoves(result.position).filter(
      (move) => move.from === "e1",
    )
    const castle = kingMoves.find(
      (move) => move.kind === "castle" && move.side === "king",
    )
    if (castle?.kind !== "castle") throw new Error("Expected a kingside castle")
    expect(boardDestinationMoves(kingMoves, castle.to)).toEqual([castle])
    expect(boardDestinationMoves(kingMoves, castle.rookFrom)).toEqual([castle])
    expect(boardDestinationMoves(kingMoves, "a8")).toEqual([])
    const hints = {
      positionFen: result.position.fen,
      requestId: "board-hint-fixture",
      player: [
        {
          color: "white",
          from: castle.from,
          to: castle.to,
          uci: castle.uci,
          castling: castle,
        },
      ],
      opponent: [{ color: "black", from: "h8", to: "h7", uci: "h8h7" }],
    } satisfies BetterHintsResult
    const copy = loadCatalog("es-419").board
    expect(hintDescriptionsForSquare(null, true, "h7", copy)).toEqual([])
    expect(hintDescriptionsForSquare(hints, false, castle.from, copy)).toEqual([
      copy.pieceHint("player"),
    ])
    expect(hintDescriptionsForSquare(hints, false, castle.to, copy)).toEqual([])
    expect(hintDescriptionsForSquare(hints, true, castle.to, copy)).toEqual([
      copy.castleHint(
        "player",
        castle.side,
        castle.to,
        castle.rookFrom,
        castle.rookTo,
      ),
    ])
    expect(hintDescriptionsForSquare(hints, true, "h7", copy)).toEqual([
      copy.moveHint("opponent", "h8"),
    ])
  })
})

describe("canonical board presentation", () => {
  it("cycles only owned pieces in displayed order with wraparound and no selection", () => {
    const pieces = [
      { color: "white", role: "king", square: "e1" },
      { color: "white", role: "pawn", square: "e2" },
      { color: "black", role: "king", square: "e8" },
    ] as const
    expect(
      cycleOwnPieceFocus(
        createBoardSquareRows("white"),
        pieces,
        "white",
        "e1",
        "nextPiece",
      ),
    ).toBe("e2")
    expect(
      cycleOwnPieceFocus(
        createBoardSquareRows("white"),
        pieces,
        "white",
        "e2",
        "previousPiece",
      ),
    ).toBe("e1")
    expect(
      cycleOwnPieceFocus(
        createBoardSquareRows("black"),
        pieces,
        "black",
        "e2",
        "nextPiece",
      ),
    ).toBe("e8")
  })
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

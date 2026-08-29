import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import BetterHintsControl from "./BetterHintsControl"
import BetterHintsOverlay from "./BetterHintsOverlay"
import CanonicalChessboard from "./CanonicalChessboard"

const HINTS = Object.freeze({
  opponent: Object.freeze([
    Object.freeze({ color: "black", from: "e7", to: "e5", uci: "e7e5" }),
    Object.freeze({ color: "black", from: "d7", to: "d5", uci: "d7d5" }),
    Object.freeze({ color: "black", from: "g8", to: "f6", uci: "g8f6" }),
  ]),
  player: Object.freeze([
    Object.freeze({ color: "white", from: "e2", to: "e4", uci: "e2e4" }),
    Object.freeze({ color: "white", from: "d2", to: "d4", uci: "d2d4" }),
    Object.freeze({ color: "white", from: "g1", to: "f3", uci: "g1f3" }),
  ]),
  positionFen: "test position",
  requestId: "test hints",
}) satisfies BetterHintsResult

const countOccurrences = (value: string, pattern: string): number =>
  value.match(new RegExp(pattern, "g"))?.length ?? 0

describe("Better Hints board presentation", () => {
  it("progresses the accessible control from pieces to moves", () => {
    const readyMarkup = renderToStaticMarkup(
      createElement(BetterHintsControl, {
        hints: null,
        matchComplete: false,
        onMoveHintsRequested: vi.fn(),
        onPieceHintsRequested: vi.fn(),
        stage: "ready",
      }),
    )
    const pieceMarkup = renderToStaticMarkup(
      createElement(BetterHintsControl, {
        hints: HINTS,
        matchComplete: false,
        onMoveHintsRequested: vi.fn(),
        onPieceHintsRequested: vi.fn(),
        stage: "piece-hints",
      }),
    )
    const moveMarkup = renderToStaticMarkup(
      createElement(BetterHintsControl, {
        hints: HINTS,
        matchComplete: false,
        onMoveHintsRequested: vi.fn(),
        onPieceHintsRequested: vi.fn(),
        stage: "move-hints",
      }),
    )

    expect(readyMarkup).toContain("Show Piece Hints")
    expect(readyMarkup).not.toContain("Better Hints legend")
    expect(pieceMarkup).toContain("Show Move Hints")
    expect(pieceMarkup).toContain('aria-label="Better Hints legend"')
    expect(pieceMarkup).toContain("Player Piece Hint")
    expect(pieceMarkup).toContain("Opponent Piece Hint")
    expect(pieceMarkup).not.toContain("Player Move Hint target")
    expect(moveMarkup).toContain("Move Hints Shown")
    expect(moveMarkup).toContain("Player Move Hint target")
    expect(moveMarkup).toContain("Opponent Move Hint target")
    expect(moveMarkup).toContain(
      "Player Move Hints: e2 to e4; d2 to d4; g1 to f3.",
    )
  })

  it("shows six shaped source cues before revealing moves", () => {
    const markup = renderToStaticMarkup(
      createElement(BetterHintsOverlay, {
        hints: HINTS,
        orientation: "white",
        showMoves: false,
      }),
    )

    expect(countOccurrences(markup, 'data-hint-kind="source"')).toBe(6)
    expect(countOccurrences(markup, 'data-hint-kind="move"')).toBe(0)
    expect(countOccurrences(markup, 'data-hint-shape="circle"')).toBe(3)
    expect(countOccurrences(markup, 'data-hint-shape="warning-triangle"')).toBe(
      3,
    )
  })

  it("reveals the same six orientation-safe moves with distinct targets", () => {
    const whiteMarkup = renderToStaticMarkup(
      createElement(BetterHintsOverlay, {
        hints: HINTS,
        orientation: "white",
        showMoves: true,
      }),
    )
    const blackMarkup = renderToStaticMarkup(
      createElement(BetterHintsOverlay, {
        hints: HINTS,
        orientation: "black",
        showMoves: true,
      }),
    )

    expect(countOccurrences(whiteMarkup, 'data-hint-kind="move"')).toBe(6)
    expect(
      countOccurrences(whiteMarkup, 'data-hint-shape="target-cross"'),
    ).toBe(3)
    expect(countOccurrences(whiteMarkup, 'data-hint-shape="x"')).toBe(3)
    expect(whiteMarkup).toContain(
      'data-destination-x="4.5" data-destination-y="4.5" data-hint-kind="move" data-hint-owner="player" data-hint-shape="target-cross" data-source-x="4.5" data-source-y="6.5"',
    )
    expect(blackMarkup).toContain(
      'data-destination-x="3.5" data-destination-y="3.5" data-hint-kind="move" data-hint-owner="player" data-hint-shape="target-cross" data-source-x="3.5" data-source-y="1.5"',
    )
  })

  it("adds non-color hint meaning to board-square names", () => {
    const position = createInitialMatchPosition({
      chess960PositionId: null,
      variant: "standard",
    })
    const markup = renderToStaticMarkup(
      createElement(CanonicalChessboard, {
        disabled: false,
        hints: HINTS,
        lastMove: null,
        legalMoves: listLegalMatchMoves(position),
        onMove: vi.fn(),
        orientation: "white",
        position,
        showMoveHints: true,
      }),
    )

    expect(markup).toContain('aria-label="e2, White pawn, Player Piece Hint"')
    expect(markup).toContain(
      'aria-label="e4, empty, Player Move Hint destination from e2"',
    )
    expect(markup).toContain('aria-label="e7, Black pawn, Opponent Piece Hint"')
    expect(markup).toContain(
      'aria-label="e5, empty, Opponent Move Hint destination from e7"',
    )
  })
})

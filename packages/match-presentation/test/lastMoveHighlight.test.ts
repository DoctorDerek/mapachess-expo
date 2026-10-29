import { describe, expect, it } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { reconstructMatchPosition } from "@mapachess/match/match-position"
import lastMoveHighlight from "../src/lastMoveHighlight.js"

const moveFromPosition = (fen: string, uci: string, chess960 = false) => {
  const id = parseChess960PositionId(518)
  if (!id.ok) throw new Error("Expected Chess960 fixture ID")
  const position = reconstructMatchPosition(
    chess960
      ? { variant: "chess960", chess960PositionId: id.positionId }
      : { variant: "standard", chess960PositionId: null },
    fen,
  )
  if (!position.ok) throw new Error("Expected valid fixture FEN")
  const legal = listLegalMatchMoves(position.position).find(
    (move) => move.uci === uci,
  )
  if (!legal) throw new Error(`Expected legal fixture move ${uci}`)
  const result = applyMatchMove(position.position, legal.id)
  if (!result.ok) throw new Error("Expected applied fixture move")
  return result.transition.move
}

describe("latest move square highlights", () => {
  it("has no marks before a move or after undoing to the start", () => {
    expect(lastMoveHighlight(null, "e2")).toBeNull()
  })

  it.each([
    ["4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "e2e4", "e2", "e4"],
    ["4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4d5", "e4", "d5"],
    ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", "e5d6", "e5", "d6"],
    ["4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8q", "a7", "a8"],
    ["4k3/4p3/8/8/8/8/8/4K3 b - - 0 1", "e7e5", "e7", "e5"],
  ] as const)(
    "marks only the origin and landing square for %s",
    (fen, uci, from, to) => {
      const move = moveFromPosition(fen, uci)
      expect(lastMoveHighlight(move, from)).toBe("origin")
      expect(lastMoveHighlight(move, to)).toBe("destination")
      expect(lastMoveHighlight(move, "h4")).toBeNull()
    },
  )

  it.each([
    ["e1g1", ["e1", "h1"], ["g1", "f1"]],
    ["e1c1", ["e1", "a1"], ["c1", "d1"]],
  ] as const)(
    "marks both castling pieces for %s",
    (uci, origins, destinations) => {
      const move = moveFromPosition("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", uci)
      for (const square of origins)
        expect(lastMoveHighlight(move, square)).toBe("origin")
      for (const square of destinations)
        expect(lastMoveHighlight(move, square)).toBe("destination")
      expect(lastMoveHighlight(move, "b1")).toBeNull()
    },
  )

  it.each([
    ["1k6/8/8/8/8/8/8/6KR w H - 0 1", "g1h1", "h1"],
    ["1k6/8/8/8/8/8/8/1K3R2 w F - 0 1", "b1f1", "b1"],
    ["1k6/8/8/8/8/8/8/5KR1 w G - 0 1", "f1g1", null],
  ] as const)(
    "prioritizes actual destinations for Chess960 %s",
    (fen, uci, origin) => {
      const move = moveFromPosition(fen, uci, true)
      expect(lastMoveHighlight(move, "g1")).toBe("destination")
      expect(lastMoveHighlight(move, "f1")).toBe("destination")
      if (origin !== null)
        expect(lastMoveHighlight(move, origin)).toBe("origin")
    },
  )
})

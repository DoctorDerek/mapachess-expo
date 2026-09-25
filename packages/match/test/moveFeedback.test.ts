import { describe, expect, it } from "vitest"
import { formatMatchMoveNotation } from "../src/matchMove.js"
import { reconstructMatchPosition } from "../src/matchPosition.js"
import { MOVE_GRADE_LABELS } from "../src/moveFeedback.js"
import { requireAppliedMove } from "./matchTestUtils.js"

describe("move grade presentation copy", () => {
  it.each([
    ["brilliant", "Brilliant !!"],
    ["genius", "Genius !"],
    ["best", "Best ★"],
    ["good", "Good ✓"],
    ["inaccuracy", "Inaccuracy ?!"],
    ["mistake", "Mistake ?"],
    ["blunder", "Blunder ??"],
  ] as const)(
    "formats %s without additional evidence or explanation",
    (grade, label) => {
      expect(MOVE_GRADE_LABELS[grade]).toBe(label)
    },
  )
})

describe("accepted move notation", () => {
  it.each([
    [
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 12",
      "d2d4",
      "12. d4",
    ],
    [
      "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 12",
      "g8f6",
      "12... Nf6",
    ],
    ["4k3/8/8/8/8/8/8/R3K2R w KQ - 0 35", "e1g1", "35. O-O"],
    ["4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 20", "d4e3", "20... dxe3"],
    ["7k/1P6/8/8/8/8/8/4K3 w - - 0 42", "b7b8q", "42. b8=Q+"],
  ])("preserves fullmove identity and SAN for %s", (fen, uci, expected) => {
    const result = reconstructMatchPosition(
      { variant: "standard", chess960PositionId: null },
      fen,
    )
    if (!result.ok) throw new Error("Invalid notation fixture")
    expect(
      formatMatchMoveNotation(requireAppliedMove(result.position, uci).move),
    ).toBe(expected)
  })
})

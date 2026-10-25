import { describe, expect, it } from "vitest"
import type { BetterHint } from "@mapachess/match/better-hints"
import createBetterHintGeometry, {
  BETTER_HINT_FRAME,
  BETTER_HINT_RIBBON,
} from "../src/betterHintGeometry.js"

const PAWN_HINT = {
  color: "white",
  from: "e2",
  to: "e4",
  uci: "e2e4",
} as const satisfies BetterHint

describe("Better Hint ribbon geometry", () => {
  it("rotates the same move and its source frame with the board", () => {
    expect(createBetterHintGeometry(PAWN_HINT, "white")).toMatchObject({
      piece: { x: 4.5, y: 6.5 },
      source: { x: 4.5, y: 6.5 },
      destination: { x: 4.5, y: 4.5 },
      rotationDegrees: -90,
    })
    expect(createBetterHintGeometry(PAWN_HINT, "black")).toMatchObject({
      piece: { x: 3.5, y: 1.5 },
      source: { x: 3.5, y: 1.5 },
      destination: { x: 3.5, y: 3.5 },
      rotationDegrees: 90,
    })
  })

  it.each([
    ["a1", "a2"],
    ["h8", "g8"],
    ["h1", "a1"],
    ["a1", "h8"],
    ["g1", "f3"],
    ["c4", "f7"],
  ] as const)(
    "keeps a forward head and readable shaft for %s to %s",
    (from, to) => {
      const hint: BetterHint = { color: "white", from, to, uci: `${from}${to}` }
      const white = createBetterHintGeometry(hint, "white")
      const black = createBetterHintGeometry(hint, "black")
      const length = Math.hypot(
        white.destination.x - white.source.x,
        white.destination.y - white.source.y,
      )

      expect(white.shaftEnd).toBeGreaterThan(BETTER_HINT_RIBBON.sourceOffset)
      expect(white.shaftEnd).toBeLessThan(length)
      expect(white.headPath).toContain(`L ${length} 0`)
      expect(white.ribbonPath).toContain(`L ${length} 0`)
      expect(white.ribbonPath).not.toMatch(/NaN|Infinity/)
      expect(white.ribbonPath).toBe(black.ribbonPath)
      expect(white.headPath).toBe(black.headPath)
      expect(white.source.x + black.source.x).toBe(8)
      expect(white.source.y + black.source.y).toBe(8)
      expect(white.destination.x + black.destination.x).toBe(8)
      expect(white.destination.y + black.destination.y).toBe(8)
      expect(Math.abs(white.rotationDegrees - black.rotationDegrees)).toBe(180)
    },
  )

  it.each(["white", "black"] as const)(
    "frames the stationary king but draws the rook's castling travel for %s",
    (orientation) => {
      const geometry = createBetterHintGeometry(
        {
          color: "white",
          from: "g1",
          to: "g1",
          uci: "g1h1",
          castling: { rookFrom: "h1", rookTo: "f1", side: "king" },
        },
        orientation,
      )
      expect(geometry.piece.x).toBe(orientation === "white" ? 6.5 : 1.5)
      expect(geometry.source.x).toBe(orientation === "white" ? 7.5 : 0.5)
      expect(geometry.destination.x).toBe(orientation === "white" ? 5.5 : 2.5)
      expect(geometry.headPath).toContain("L 2 0")
    },
  )

  it("keeps ordinary castling attached to the moving king", () => {
    const geometry = createBetterHintGeometry(
      {
        color: "black",
        from: "e8",
        to: "g8",
        uci: "e8h8",
        castling: { rookFrom: "h8", rookTo: "f8", side: "king" },
      },
      "black",
    )
    expect(geometry.source).toEqual(geometry.piece)
    expect(geometry.source).toEqual({ x: 3.5, y: 7.5 })
    expect(geometry.destination).toEqual({ x: 1.5, y: 7.5 })
  })

  it.each(["a2", "b2", "a3", "b3", "h8"] as const)(
    "keeps at least one opponent gap before the head for a1 to %s",
    (to) => {
      const geometry = createBetterHintGeometry(
        { color: "black", from: "a1", to, uci: `a1${to}` },
        "white",
      )
      const [dash = 0, gap = 0] = geometry.opponentDash.split(" ").map(Number)
      const shaftLength =
        geometry.shaftEnd -
        BETTER_HINT_RIBBON.shaftHeadOverlap -
        BETTER_HINT_RIBBON.sourceOffset

      expect(dash).toBeGreaterThan(0)
      expect(gap).toBeGreaterThan(0)
      expect(dash + gap).toBeLessThan(shaftLength)
      expect(dash).toBeLessThanOrEqual(BETTER_HINT_RIBBON.opponentDashLength)
      expect(gap).toBeLessThanOrEqual(BETTER_HINT_RIBBON.opponentGapLength)
    },
  )

  it("keeps source frames inside their square and arrowheads inside edge squares", () => {
    expect(
      BETTER_HINT_FRAME.inset - BETTER_HINT_FRAME.outlineWidth / 2,
    ).toBeGreaterThan(0)
    expect(
      BETTER_HINT_FRAME.inset +
        BETTER_HINT_FRAME.size +
        BETTER_HINT_FRAME.outlineWidth / 2,
    ).toBeLessThan(1)
    expect(
      (BETTER_HINT_RIBBON.headWidth + BETTER_HINT_RIBBON.outlineWidth) / 2,
    ).toBeLessThan(0.5)
  })
})

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

const CAPTURE_HINTS = [
  { color: "white", from: "h5", to: "f7", uci: "h5f7" },
  { color: "white", from: "d2", to: "d4", uci: "d2d4" },
  { color: "white", from: "c4", to: "f7", uci: "c4f7" },
  { color: "black", from: "d8", to: "e7", uci: "d8e7" },
  { color: "black", from: "g7", to: "g6", uci: "g7g6" },
  { color: "black", from: "g8", to: "h6", uci: "g8h6" },
] as const satisfies readonly BetterHint[]

describe("Better Hint ribbon geometry", () => {
  it("leaves the opponent head open only where it meets the shaft", () => {
    const geometry = createBetterHintGeometry(PAWN_HINT, "white")
    const neck = 2 - BETTER_HINT_RIBBON.headLength
    const halfShaft = BETTER_HINT_RIBBON.width / 2
    const halfHead = BETTER_HINT_RIBBON.headWidth / 2
    expect(geometry.headPath).toBe(
      `M ${neck} ${-halfShaft} L ${neck} ${-halfHead} L 2 0 L ${neck} ${halfHead} L ${neck} ${halfShaft}`,
    )
    expect(geometry.shaftEnd).toBeGreaterThan(neck)
    expect(geometry.ribbonPath).toContain("Z")
  })

  it.each(["white", "black"] as const)(
    "separates only shared destinations without changing targets for %s",
    (orientation) => {
      const originalHints = structuredClone(CAPTURE_HINTS)
      for (const hint of CAPTURE_HINTS) {
        const baseline = createBetterHintGeometry(hint, orientation)
        const separated = createBetterHintGeometry(
          hint,
          orientation,
          CAPTURE_HINTS,
        )
        expect(separated).toMatchObject({
          piece: baseline.piece,
          source: baseline.source,
          destination: baseline.destination,
          rotationDegrees: baseline.rotationDegrees,
        })
        if (hint.to !== "f7") {
          expect(separated).toEqual(baseline)
          continue
        }
        expect(baseline.shaftEnd - separated.shaftEnd).toBeCloseTo(
          BETTER_HINT_RIBBON.sharedDestinationInset,
        )
        const tipDistance =
          separated.shaftEnd -
          BETTER_HINT_RIBBON.shaftHeadOverlap +
          BETTER_HINT_RIBBON.headLength
        expect(separated.headPath).toContain(`L ${tipDistance} 0`)
        expect(separated.ribbonPath).toContain(`L ${tipDistance} 0`)
        const angle = (separated.rotationDegrees * Math.PI) / 180
        expect(
          Math.floor(separated.source.x + Math.cos(angle) * tipDistance),
        ).toBe(Math.floor(separated.destination.x))
        expect(
          Math.floor(separated.source.y + Math.sin(angle) * tipDistance),
        ).toBe(Math.floor(separated.destination.y))
        expect(
          createBetterHintGeometry(
            hint,
            orientation,
            [...CAPTURE_HINTS].reverse(),
          ),
        ).toEqual(separated)
        expect(createBetterHintGeometry(hint, orientation, [hint])).toEqual(
          baseline,
        )
      }
      expect(CAPTURE_HINTS).toEqual(originalHints)
    },
  )

  it.each(["white", "black"] as const)(
    "keeps a readable dashed shaft for short shared arrivals from %s",
    (orientation) => {
      const hints = [
        PAWN_HINT,
        { color: "black", from: "e5", to: "e4", uci: "e5e4" },
        { color: "white", from: "d3", to: "e4", uci: "d3e4" },
      ] as const satisfies readonly BetterHint[]
      for (const hint of hints) {
        const baseline = createBetterHintGeometry(hint, orientation)
        const separated = createBetterHintGeometry(hint, orientation, hints)
        const shaftLength =
          separated.shaftEnd -
          BETTER_HINT_RIBBON.shaftHeadOverlap -
          BETTER_HINT_RIBBON.sourceOffset
        const [dash = 0, gap = 0] = separated.opponentDash
          .split(" ")
          .map(Number)
        expect(separated.shaftEnd).toBeLessThan(baseline.shaftEnd)
        expect(shaftLength).toBeGreaterThanOrEqual(
          BETTER_HINT_RIBBON.minimumShaftLength,
        )
        expect(dash).toBeGreaterThan(0)
        expect(gap).toBeGreaterThan(0)
        expect(dash + gap).toBeLessThan(shaftLength)
        expect(separated.ribbonPath).not.toMatch(/NaN|Infinity/)
      }
    },
  )

  it.each(["white", "black"] as const)(
    "separates a stationary-king castle by its rendered rook destination for %s",
    (orientation) => {
      const castle = {
        color: "white",
        from: "g1",
        to: "g1",
        uci: "g1h1",
        castling: { rookFrom: "h1", rookTo: "f1", side: "king" },
      } as const satisfies BetterHint
      const hints = [
        castle,
        { color: "white", from: "h2", to: "f1", uci: "h2f1" },
      ] as const satisfies readonly BetterHint[]
      const baseline = createBetterHintGeometry(castle, orientation)
      const separated = createBetterHintGeometry(castle, orientation, hints)
      expect(separated).toMatchObject({
        piece: baseline.piece,
        source: baseline.source,
        destination: baseline.destination,
        rotationDegrees: baseline.rotationDegrees,
      })
      expect(baseline.shaftEnd - separated.shaftEnd).toBeCloseTo(
        BETTER_HINT_RIBBON.sharedDestinationInset,
      )
      expect(separated.headPath).toContain(
        `L ${2 - BETTER_HINT_RIBBON.sharedDestinationInset} 0`,
      )
    },
  )

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

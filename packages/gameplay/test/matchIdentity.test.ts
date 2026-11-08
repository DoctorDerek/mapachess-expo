import { describe, expect, it } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchStartingPosition } from "@mapachess/match/match-position"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import { createMatchId, selectStoryPlayerColor } from "../src/matchIdentity.js"

const seed = parseDeterministicRandomSeed("00000001000000020000000300000004")
const parsed = parseChess960PositionId(959)
if (!parsed.ok) throw new Error("The identity fixture requires position 959.")
const positions: readonly MatchStartingPosition[] = [
  { variant: "standard", chess960PositionId: null },
  { variant: "chess960", chess960PositionId: parsed.positionId },
]

describe("canonical match identity", () => {
  it.each(STOCKFISH_OPPONENTS)(
    "preserves stored Story and Challenge IDs for $id",
    (opponent) => {
      const animal = opponent.id.replace(/-stockfish$/, "")
      for (const position of positions) {
        const layout = position.variant === "standard" ? "" : "959/"
        expect(
          createMatchId(seed, position, { mode: "story" }, opponent.id),
        ).toBe(`${position.variant}-story-${animal}/${layout}${seed}`)
        for (const playerColor of ["white", "black"] as const) {
          expect(
            createMatchId(
              seed,
              position,
              { mode: "challenge", playerColor },
              opponent.id,
            ),
          ).toBe(
            `${position.variant}-challenge-${animal}/${layout}${playerColor}/${seed}`,
          )
        }
      }
    },
  )

  it("retains the original default Chicken Story identity", () => {
    expect(createMatchId(seed)).toBe(`standard-story-chicken/${seed}`)
  })

  it.each([
    ["00000001000000020000000300000004", "white"],
    ["00000001020000000000000300000004", "black"],
  ] as const)("preserves seeded Story color for %s", (raw, expected) => {
    const parsedSeed = parseDeterministicRandomSeed(raw)
    expect(selectStoryPlayerColor(parsedSeed)).toBe(expected)
    expect(selectStoryPlayerColor(parsedSeed)).toBe(expected)
  })
})

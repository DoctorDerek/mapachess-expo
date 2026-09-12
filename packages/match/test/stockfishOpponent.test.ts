import { describe, expect, expectTypeOf, it } from "vitest"
import {
  IMPLEMENTED_DURABLE_OPPONENT_IDS,
  type ImplementedDurableOpponentId,
} from "../src/durableMatchRecord.js"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "../src/stockfishOpponent.js"

describe("canonical Stockfish opponent identities", () => {
  it("preserves the authored Story ordering and target Elo ladder", () => {
    expect(
      STOCKFISH_OPPONENTS.map(({ id, displayName, storyTargetElo }) => [
        id,
        displayName,
        storyTargetElo,
      ]),
    ).toEqual([
      ["chicken-stockfish", "Chicken Stockfish", 100],
      ["bunny-stockfish", "Bunny Stockfish", 200],
      ["dog-stockfish", "Dog Stockfish", 300],
      ["cat-stockfish", "Cat Stockfish", 400],
      ["mouse-stockfish", "Mouse Stockfish", 500],
      ["frog-stockfish", "Frog Stockfish", 600],
      ["turtle-stockfish", "Turtle Stockfish", 700],
      ["panda-stockfish", "Panda Stockfish", 800],
      ["otter-stockfish", "Otter Stockfish", 900],
      ["raccoon-stockfish", "Raccoon Stockfish", 1000],
      ["axolotl-stockfish", "Axolotl Stockfish", 1100],
      ["parrot-stockfish", "Parrot Stockfish", 1200],
      ["hedgehog-stockfish", "Hedgehog Stockfish", 1300],
      ["deer-stockfish", "Deer Stockfish", 1400],
      ["fox-stockfish", "Fox Stockfish", 1500],
      ["wolf-stockfish", "Wolf Stockfish", 1600],
      ["falcon-stockfish", "Falcon Stockfish", 1700],
      ["crane-stockfish", "Crane Stockfish", 1800],
      ["crow-stockfish", "Crow Stockfish", 1900],
      ["bat-stockfish", "Bat Stockfish", 2000],
      ["ninja-stockfish", "Ninja Stockfish", 2100],
      ["war-hero-stockfish", "War Hero Stockfish", 2200],
      ["dragonfly-stockfish", "Dragonfly Stockfish", 2300],
    ])
    STOCKFISH_OPPONENTS.forEach((opponent, index) => {
      expect(opponent.storyPosition).toBe(index + 1)
      expect(stockfishOpponent(opponent.id)).toBe(opponent)
      expect(Object.isFrozen(opponent)).toBe(true)
    })
    expect(Object.isFrozen(STOCKFISH_OPPONENTS)).toBe(true)
  })

  it("supports the complete canonical roster in durable saves", () => {
    expect(IMPLEMENTED_DURABLE_OPPONENT_IDS).toEqual(
      STOCKFISH_OPPONENTS.map(({ id }) => id),
    )
    expectTypeOf<ImplementedDurableOpponentId>().toExtend<StockfishOpponentId>()
  })
})

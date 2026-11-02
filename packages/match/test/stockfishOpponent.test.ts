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
      ["bunny-stockfish", "Bunny Stockfish", 175],
      ["dog-stockfish", "Dog Stockfish", 250],
      ["cat-stockfish", "Cat Stockfish", 350],
      ["mouse-stockfish", "Mouse Stockfish", 425],
      ["squirrel-stockfish", "Squirrel Stockfish", 500],
      ["frog-stockfish", "Frog Stockfish", 575],
      ["turtle-stockfish", "Turtle Stockfish", 650],
      ["panda-stockfish", "Panda Stockfish", 725],
      ["otter-stockfish", "Otter Stockfish", 825],
      ["raccoon-stockfish", "Raccoon Stockfish", 900],
      ["axolotl-stockfish", "Axolotl Stockfish", 975],
      ["parrot-stockfish", "Parrot Stockfish", 1050],
      ["hedgehog-stockfish", "Hedgehog Stockfish", 1125],
      ["deer-stockfish", "Deer Stockfish", 1200],
      ["fox-stockfish", "Fox Stockfish", 1300],
      ["wolf-stockfish", "Wolf Stockfish", 1375],
      ["tiger-stockfish", "Tiger Stockfish", 1450],
      ["falcon-stockfish", "Falcon Stockfish", 1525],
      ["crane-stockfish", "Crane Stockfish", 1600],
      ["crow-stockfish", "Crow Stockfish", 1675],
      ["bat-stockfish", "Bat Stockfish", 1775],
      ["ninja-stockfish", "Ninja Stockfish", 1850],
      ["war-hero-stockfish", "War Hero Stockfish", 1925],
      ["dragonfly-stockfish", "Dragonfly Stockfish", 2000],
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

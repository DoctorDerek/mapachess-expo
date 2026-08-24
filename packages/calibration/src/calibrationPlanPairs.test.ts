import { describe, expect, it } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import listCalibrationPlanPairs from "./calibrationPlanPairs"

describe("calibration plan pairs", () => {
  it("groups each pair and restores its game order", () => {
    const plan = standardPlanFixture()
    const pairs = listCalibrationPlanPairs({
      ...plan,
      games: plan.games.toReversed(),
    })

    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual(plan.games)
  })

  it("rejects a plan with an incomplete pair", () => {
    const plan = standardPlanFixture()

    expect(() =>
      listCalibrationPlanPairs({
        ...plan,
        games: plan.games.slice(0, 1),
      }),
    ).toThrow("A calibration plan requires complete game pairs.")
  })

  it("rejects duplicate game positions within a pair", () => {
    const plan = standardPlanFixture()
    const first = plan.games[0]
    if (first === undefined) throw new Error("Fixture game is missing.")

    expect(() =>
      listCalibrationPlanPairs({
        ...plan,
        games: [first, first],
      }),
    ).toThrow("A calibration plan requires complete game pairs.")
  })
})

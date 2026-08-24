import type {
  CalibrationGame,
  CalibrationPairId,
  CalibrationPlan,
} from "./calibrationPlan.js"

export type CalibrationPlanPair = readonly [CalibrationGame, CalibrationGame]

export default function listCalibrationPlanPairs(
  plan: CalibrationPlan,
): readonly CalibrationPlanPair[] {
  const gamesByPairId = new Map<CalibrationPairId, CalibrationGame[]>()

  for (const game of plan.games) {
    const pairGames = gamesByPairId.get(game.pairId)
    if (pairGames === undefined) gamesByPairId.set(game.pairId, [game])
    else pairGames.push(game)
  }

  return [...gamesByPairId.values()].map((games) => {
    const ordered = games.toSorted(
      (left, right) => left.gameInPair - right.gameInPair,
    )
    const first = ordered[0]
    const second = ordered[1]
    if (
      ordered.length !== 2 ||
      first === undefined ||
      second === undefined ||
      first.gameInPair !== 1 ||
      second.gameInPair !== 2
    ) {
      throw new TypeError("A calibration plan requires complete game pairs.")
    }

    return [first, second]
  })
}

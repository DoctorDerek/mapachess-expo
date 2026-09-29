import type { MatchConclusion } from "@mapachess/match/match-conclusion"
import type { MatchColor } from "@mapachess/match/match-position"
import { INITIAL_PLAYER_ELO } from "./playerData.js"

export const playerResultScore = (
  conclusion: MatchConclusion,
  playerColor: MatchColor,
): number =>
  conclusion.type === "checkmate" || conclusion.type === "resignation"
    ? Number(conclusion.winner === playerColor)
    : 0.5

export const updatedPlayerElo = (
  playerElo: number,
  ratedMatchCount: number,
  opponentElo: number,
  actualScore: number,
): number => {
  const expectedScore = 1 / (1 + 10 ** ((opponentElo - playerElo) / 400))
  const adjustmentCoefficient = Math.max(32, 256 - (224 * ratedMatchCount) / 30)
  return Math.max(
    INITIAL_PLAYER_ELO,
    playerElo + adjustmentCoefficient * (actualScore - expectedScore),
  )
}

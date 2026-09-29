import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { playerResultScore } from "./playerElo.js"

export const GLOBAL_XP_QUANTUM = 4 as const
export const COMPLETED_MATCH_XP = GLOBAL_XP_QUANTUM
export const STRONGER_CALIBRATED_WIN_BONUS_XP = GLOBAL_XP_QUANTUM
export const STRONGER_OPPONENT_MARGIN_ELO = 100 as const

export const LEVEL_ACHIEVEMENTS = [
  { id: "reach-level-5", level: 5, title: "Reach Level 5" },
  { id: "reach-level-10", level: 10, title: "Reach Level 10" },
  { id: "reach-level-25", level: 25, title: "Reach Level 25" },
  { id: "reach-level-37", level: 37, title: "Reach Level 37" },
  { id: "reach-level-50", level: 50, title: "Reach Level 50" },
  { id: "reach-level-77", level: 77, title: "Reach Level 77" },
  { id: "reach-level-100", level: 100, title: "Reach Level 100" },
] as const

export type LevelAchievementId = (typeof LEVEL_ACHIEVEMENTS)[number]["id"]

export const levelFromTotalXp = (totalXp: number): number => {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
    throw new TypeError("Global XP must be a nonnegative safe integer.")
  }
  return 1 + Number((11n * BigInt(totalXp)) / 20n)
}

export const xpAtLevel = (level: number): number => {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new TypeError("Player Level must be a positive safe integer.")
  }
  const xp = (20n * BigInt(level - 1) + 10n) / 11n
  if (xp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Player Level exceeds the supported XP range.")
  }
  return Number(xp)
}

export const completedMatchXpAward = (match: DurableMatchRecord): number => {
  if (match.conclusion === null) {
    throw new TypeError("An unfinished match cannot award XP.")
  }
  const strongerCalibratedWin =
    typeof match.ratedOpponentElo === "number" &&
    match.ratedOpponentElo >=
      match.playerEloAtStart + STRONGER_OPPONENT_MARGIN_ELO &&
    playerResultScore(match.conclusion, match.playerColor) === 1
  return (
    COMPLETED_MATCH_XP +
    (strongerCalibratedWin ? STRONGER_CALIBRATED_WIN_BONUS_XP : 0)
  )
}

export const levelAchievementsCrossed = (
  totalXpBefore: number,
  totalXpAfter: number,
): readonly LevelAchievementId[] => {
  const before = levelFromTotalXp(totalXpBefore)
  const after = levelFromTotalXp(totalXpAfter)
  if (totalXpAfter < totalXpBefore) {
    throw new TypeError("Global XP cannot decrease after a match.")
  }
  return Object.freeze(
    LEVEL_ACHIEVEMENTS.filter(
      ({ level }) => before < level && level <= after,
    ).map(({ id }) => id),
  )
}

export const levelProgress = (
  totalXp: number,
): Readonly<{ level: number; current: number; required: number }> => {
  const level = levelFromTotalXp(totalXp)
  const start = xpAtLevel(level)
  const end = xpAtLevel(level + 1)
  return Object.freeze({
    level,
    current: totalXp - start,
    required: end - start,
  })
}

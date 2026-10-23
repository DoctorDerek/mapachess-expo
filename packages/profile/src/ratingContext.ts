import {
  AUTO_HINT_MODE_PRESENTATION,
  type AutoHintMode,
} from "@mapachess/match/auto-hint-mode"
import type {
  DurableMatchRecord,
  StartingPlayerElos,
} from "@mapachess/match/durable-match-record"
import {
  MATCH_VARIANTS,
  type MatchVariant,
} from "@mapachess/match/match-variant"
import {
  TIME_CATEGORIES,
  timeCategory,
  type TimeCategory,
} from "@mapachess/match/time-control"
import {
  MATCH_MEDALS,
  matchMedalEligibility,
  type MatchMedal,
} from "./matchMedal.js"

export type PlayerEloRatingId = `${MatchVariant}-${TimeCategory}-${MatchMedal}`

export type CardRatingContext = Readonly<{
  category: TimeCategory
  assistance: MatchMedal
}>

export const DEFAULT_CARD_RATING_CONTEXT: CardRatingContext = Object.freeze({
  category: "untimed",
  assistance: "bronze",
})

export const sameCardRatingContext = (
  left: CardRatingContext,
  right: CardRatingContext,
): boolean =>
  left.category === right.category && left.assistance === right.assistance

export const playerRatingId = (
  variant: MatchVariant,
  category: TimeCategory,
  assistance: MatchMedal,
): PlayerEloRatingId => `${variant}-${category}-${assistance}`

export const matchPlayerRatingId = (
  match: DurableMatchRecord,
): PlayerEloRatingId =>
  playerRatingId(
    match.startingPosition.variant,
    timeCategory(match.timeControl),
    matchMedalEligibility(match),
  )

export const startingRatingAssistance = (mode: AutoHintMode): MatchMedal =>
  AUTO_HINT_MODE_PRESENTATION[mode].medalTier

export function startingPlayerElos(
  ratings: Readonly<Record<PlayerEloRatingId, number>>,
  variant: MatchVariant,
  category: TimeCategory,
): StartingPlayerElos {
  return Object.freeze({
    bronze: ratings[playerRatingId(variant, category, "bronze")],
    silver: ratings[playerRatingId(variant, category, "silver")],
    gold: ratings[playerRatingId(variant, category, "gold")],
  })
}

export const PLAYER_RATING_CONTEXTS = Object.freeze(
  MATCH_VARIANTS.flatMap((variant) =>
    TIME_CATEGORIES.flatMap((category) =>
      MATCH_MEDALS.map((assistance) =>
        Object.freeze({
          id: playerRatingId(variant, category, assistance),
          variant,
          category,
          assistance,
        }),
      ),
    ),
  ),
)

const completeRatingValues = (
  values: Partial<Record<PlayerEloRatingId, number>>,
): values is Record<PlayerEloRatingId, number> =>
  PLAYER_ELO_RATING_IDS.every((id) => typeof values[id] === "number")

export function ratingValues(
  valueFor: (id: PlayerEloRatingId) => number,
): Readonly<Record<PlayerEloRatingId, number>> {
  const values: Partial<Record<PlayerEloRatingId, number>> = {}
  for (const id of PLAYER_ELO_RATING_IDS) values[id] = valueFor(id)
  if (!completeRatingValues(values))
    throw new TypeError("Incomplete player rating contexts.")
  return Object.freeze(values)
}
export const PLAYER_ELO_RATING_IDS = Object.freeze(
  PLAYER_RATING_CONTEXTS.map(({ id }) => id),
)

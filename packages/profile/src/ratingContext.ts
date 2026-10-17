import {
  MATCH_VARIANTS,
  type MatchVariant,
} from "@mapachess/match/match-variant"
import {
  TIME_CATEGORIES,
  type TimeCategory,
} from "@mapachess/match/time-control"

export type PlayerEloRatingId =
  MatchVariant | `${MatchVariant}-${Exclude<TimeCategory, "untimed">}`

export const playerRatingId = (
  variant: MatchVariant,
  category: TimeCategory = "untimed",
): PlayerEloRatingId =>
  category === "untimed" ? variant : `${variant}-${category}`

export const PLAYER_RATING_CONTEXTS = Object.freeze(
  MATCH_VARIANTS.flatMap((variant) =>
    TIME_CATEGORIES.map((category) =>
      Object.freeze({
        id: playerRatingId(variant, category),
        variant,
        category,
      }),
    ),
  ),
)
export const PLAYER_ELO_RATING_IDS = Object.freeze(
  PLAYER_RATING_CONTEXTS.map(({ id }) => id),
)

import {
  MATCH_VARIANTS,
  type MatchVariant,
} from "@mapachess/match/match-variant"
import {
  TIME_CATEGORIES,
  type TimeCategory,
} from "@mapachess/match/time-control"
import {
  requireEnumValue,
  requireExactKeys,
  requireObject,
  requirePlayerElo,
  requireSafeRevision,
} from "./decodePrimitives.js"
import { MATCH_MEDALS, matchMedalEligibility } from "./matchMedal.js"
import {
  ASSISTANCE_RATINGS_PLAYER_DATA_SCHEMA_VERSION,
  TIMED_CHESS_PLAYER_DATA_SCHEMA_VERSION,
  type AcceptedMatchReward,
  type MapachessPlayerData,
} from "./playerData.js"
import {
  PLAYER_ELO_RATING_IDS,
  ratingValues,
  type CardRatingContext,
  type PlayerEloRatingId,
} from "./ratingContext.js"

export function decodeCardRatingContext(received: unknown): CardRatingContext {
  const path = "$.settings.cardRatingContext"
  const object = requireObject(received, path)
  requireExactKeys(object, ["category", "assistance"], path)
  return Object.freeze({
    category: requireEnumValue(
      object.category,
      TIME_CATEGORIES,
      `${path}.category`,
    ),
    assistance: requireEnumValue(
      object.assistance,
      MATCH_MEDALS,
      `${path}.assistance`,
    ),
  })
}

export type PreviousRatingId =
  MatchVariant | `${MatchVariant}-${Exclude<TimeCategory, "untimed">}`
export const PREVIOUS_RATING_IDS = [
  "standard",
  "standard-bullet",
  "standard-blitz",
  "standard-rapid",
  "chess960",
  "chess960-bullet",
  "chess960-blitz",
  "chess960-rapid",
] as const satisfies readonly PreviousRatingId[]
export const previousRatingId = (
  variant: MatchVariant,
  category: TimeCategory = "untimed",
): PreviousRatingId =>
  category === "untimed" ? variant : `${variant}-${category}`
export type SourceRatingValues = Readonly<
  Partial<Record<PlayerEloRatingId | PreviousRatingId, number>>
>

export const sourceRatingIds = (
  version: number,
): readonly (PlayerEloRatingId | PreviousRatingId)[] =>
  version >= ASSISTANCE_RATINGS_PLAYER_DATA_SCHEMA_VERSION
    ? PLAYER_ELO_RATING_IDS
    : version >= TIMED_CHESS_PLAYER_DATA_SCHEMA_VERSION
      ? PREVIOUS_RATING_IDS
      : MATCH_VARIANTS

export function decodeSourceRatingValues(
  received: unknown,
  path: string,
  version: number,
  counts = false,
): SourceRatingValues {
  const object = requireObject(received, path)
  const ids = sourceRatingIds(version)
  requireExactKeys(object, ids, path)
  const requireValue = counts ? requireSafeRevision : requirePlayerElo
  const values: Partial<Record<PlayerEloRatingId | PreviousRatingId, number>> =
    {}
  for (const id of ids) values[id] = requireValue(object[id], `${path}.${id}`)
  return Object.freeze(values)
}

export function decodeRatingValues(
  received: unknown,
  path: string,
  counts = false,
): Readonly<Record<PlayerEloRatingId, number>> {
  const object = requireObject(received, path)
  requireExactKeys(object, PLAYER_ELO_RATING_IDS, path)
  const requireValue = counts ? requireSafeRevision : requirePlayerElo
  return ratingValues((id) => requireValue(object[id], `${path}.${id}`))
}

export function retirePreviousRatingContribution(
  data: MapachessPlayerData,
): AcceptedMatchReward | null {
  const reward = data.lastAcceptedResultReward
  if (reward === null) return null
  const contribution = reward.contribution
  if (contribution === undefined)
    return Object.freeze({ ...reward, ratedElo: null })

  const activeUndoneMatch =
    !contribution.applied && data.activeMatch?.matchId === reward.matchId
      ? data.activeMatch
      : null
  const retiredContribution: NonNullable<AcceptedMatchReward["contribution"]> =
    Object.freeze({
      ...contribution,
      ratedMatchCountBefore: null,
      eloState: contribution.applied ? "superseded" : "rebase",
    })
  return Object.freeze({
    ...reward,
    ratedElo: null,
    contribution:
      activeUndoneMatch === null
        ? retiredContribution
        : Object.freeze({
            ...retiredContribution,
            assistance: matchMedalEligibility(activeUndoneMatch),
          }),
  })
}

import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"

export const MAPACHESS_PLAYER_DATA_SCHEMA = "mapachess-player-data" as const
export const MAPACHESS_PLAYER_DATA_SCHEMA_VERSION = 1 as const
export const INITIAL_PLAYER_ELO = 100 as const
export const PLAYER_ELO_RATING_IDS = [
  "standardStory",
  "standardChallenge",
  "chess960Story",
  "chess960Challenge",
] as const

export type PlayerEloRatingId = (typeof PLAYER_ELO_RATING_IDS)[number]

export type PlayerEloRatings = Readonly<Record<PlayerEloRatingId, number>>

export type MapachessPlayerDataV1 = Readonly<{
  activeMatch: DurableMatchRecord | null
  firstRun: Readonly<{
    autoHintsChoiceCompleted: boolean
  }>
  ratings: PlayerEloRatings
  revision: number
  schema: typeof MAPACHESS_PLAYER_DATA_SCHEMA
  schemaVersion: typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
  settings: Readonly<{
    autoHintsEnabled: boolean
  }>
}>

export type MapachessPlayerData = MapachessPlayerDataV1

export const createInitialPlayerEloRatings = (): PlayerEloRatings =>
  Object.freeze({
    chess960Challenge: INITIAL_PLAYER_ELO,
    chess960Story: INITIAL_PLAYER_ELO,
    standardChallenge: INITIAL_PLAYER_ELO,
    standardStory: INITIAL_PLAYER_ELO,
  })

export default function createInitialMapachessPlayerData(): MapachessPlayerData {
  return Object.freeze({
    activeMatch: null,
    firstRun: Object.freeze({ autoHintsChoiceCompleted: false }),
    ratings: createInitialPlayerEloRatings(),
    revision: 0,
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    settings: Object.freeze({ autoHintsEnabled: true }),
  })
}

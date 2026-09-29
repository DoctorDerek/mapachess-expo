import {
  DEFAULT_AUTO_HINT_MODE,
  type AutoHintMode,
} from "@mapachess/match/auto-hint-mode"
import {
  DEFAULT_CHALLENGE_SETUP,
  type ChallengePositionSetup,
  type ChallengeSetup,
} from "@mapachess/match/challenge-setup"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import {
  createInitialChallengeHistory,
  type ChallengeHistory,
} from "./challengeHistory.js"
import {
  createInitialStoryProgress,
  type StoryProgress,
} from "./storyProgress.js"

export const MAPACHESS_PLAYER_DATA_SCHEMA = "mapachess-player-data" as const
export const LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION = 1 as const
export const THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION = 2 as const
export const CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION = 3 as const
export const STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION = 4 as const
export const INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION = 5 as const
export const LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION = 6 as const
export const MAPACHESS_PLAYER_DATA_SCHEMA_VERSION = 7 as const
export const INITIAL_PLAYER_ELO = 100 as const
export const LEGACY_PLAYER_ELO_RATING_IDS = [
  "standardStory",
  "standardChallenge",
  "chess960Story",
  "chess960Challenge",
] as const
export const PLAYER_ELO_RATING_IDS = ["standard", "chess960"] as const

export type LegacyPlayerEloRatingId =
  (typeof LEGACY_PLAYER_ELO_RATING_IDS)[number]
export type PlayerEloRatingId = (typeof PLAYER_ELO_RATING_IDS)[number]

export type LegacyPlayerEloRatings = Readonly<
  Record<LegacyPlayerEloRatingId, number>
>
export type PlayerEloRatings = Readonly<Record<PlayerEloRatingId, number>>
export type RatedMatchCounts = Readonly<Record<PlayerEloRatingId, number>>

export type MapachessPlayerDataV1 = Readonly<{
  activeMatch: DurableMatchRecord | null
  firstRun: Readonly<{
    autoHintsChoiceCompleted: boolean
  }>
  ratings: LegacyPlayerEloRatings
  revision: number
  schema: typeof MAPACHESS_PLAYER_DATA_SCHEMA
  schemaVersion: typeof LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
  settings: Readonly<{
    autoHintsEnabled: boolean
  }>
}>

export type MapachessPlayerDataV2 = Readonly<{
  activeMatch: DurableMatchRecord | null
  ratings: LegacyPlayerEloRatings
  revision: number
  schema: typeof MAPACHESS_PLAYER_DATA_SCHEMA
  schemaVersion: typeof THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
  settings: Readonly<{
    autoHintMode: AutoHintMode
  }>
}>

export type MapachessPlayerDataV3 = Readonly<
  Omit<MapachessPlayerDataV2, "schemaVersion" | "settings"> & {
    schemaVersion: typeof CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION
    settings: Readonly<{
      autoHintMode: AutoHintMode
      challengeSetup: ChallengePositionSetup
    }>
  }
>

export type MapachessPlayerDataV4 = Readonly<
  Omit<MapachessPlayerDataV3, "schemaVersion"> & {
    schemaVersion: typeof STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
    storyProgress: StoryProgress
  }
>

export type MapachessPlayerDataV6 = Readonly<
  Omit<MapachessPlayerDataV4, "schemaVersion" | "settings"> & {
    schemaVersion: typeof LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION
    challengeHistory: ChallengeHistory
    settings: Readonly<{
      autoHintMode: AutoHintMode
      challengeSetup: ChallengeSetup
    }>
  }
>

export type MapachessPlayerData = Readonly<
  Omit<MapachessPlayerDataV6, "schemaVersion" | "ratings"> & {
    schemaVersion: typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
    legacyRatings: LegacyPlayerEloRatings
    processedMatchResultIds: readonly string[]
    ratedMatchCounts: RatedMatchCounts
    ratings: PlayerEloRatings
  }
>

export const createInitialLegacyPlayerEloRatings = (): LegacyPlayerEloRatings =>
  Object.freeze({
    chess960Challenge: INITIAL_PLAYER_ELO,
    chess960Story: INITIAL_PLAYER_ELO,
    standardChallenge: INITIAL_PLAYER_ELO,
    standardStory: INITIAL_PLAYER_ELO,
  })

export const createInitialPlayerEloRatings = (): PlayerEloRatings =>
  Object.freeze({
    chess960: INITIAL_PLAYER_ELO,
    standard: INITIAL_PLAYER_ELO,
  })

export const createInitialRatedMatchCounts = (): RatedMatchCounts =>
  Object.freeze({ chess960: 0, standard: 0 })

export default function createInitialMapachessPlayerData(): MapachessPlayerData {
  return Object.freeze({
    activeMatch: null,
    challengeHistory: createInitialChallengeHistory(),
    legacyRatings: createInitialLegacyPlayerEloRatings(),
    processedMatchResultIds: Object.freeze([]),
    ratedMatchCounts: createInitialRatedMatchCounts(),
    ratings: createInitialPlayerEloRatings(),
    revision: 0,
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    storyProgress: createInitialStoryProgress(),
    settings: Object.freeze({
      autoHintMode: DEFAULT_AUTO_HINT_MODE,
      challengeSetup: DEFAULT_CHALLENGE_SETUP,
    }),
  })
}

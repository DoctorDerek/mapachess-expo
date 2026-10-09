import {
  DEFAULT_COACH_COLLECTION,
  type CoachCollectionId,
} from "@mapachess/match-presentation/coach-portrait"
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
import type { MatchConclusion } from "@mapachess/match/match-conclusion"
import type { MatchMoveId } from "@mapachess/match/match-move"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  createInitialChallengeHistory,
  type ChallengeHistory,
} from "./challengeHistory.js"
import {
  DEFAULT_CHESS_APPEARANCE,
  type ChessAppearanceSettings,
} from "./chessAppearanceSettings.js"
import type { LevelAchievementId } from "./globalXp.js"
import {
  DEFAULT_PLAYER_APPEARANCE,
  type PlayerAppearance,
} from "./playerAppearance.js"
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
export const TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION = 7 as const
export const GLOBAL_XP_PLAYER_DATA_SCHEMA_VERSION = 8 as const
export const REVERSIBLE_RESULT_PLAYER_DATA_SCHEMA_VERSION = 9 as const
export const PLAYER_APPEARANCE_DATA_SCHEMA_VERSION = 10 as const
export const HERO_EQUIPMENT_PLAYER_DATA_SCHEMA_VERSION = 11 as const
export const CHESS_APPEARANCE_PLAYER_DATA_SCHEMA_VERSION = 12 as const
export const COACH_COLLECTION_PLAYER_DATA_SCHEMA_VERSION = 13 as const
export const MAPACHESS_PLAYER_DATA_SCHEMA_VERSION =
  COACH_COLLECTION_PLAYER_DATA_SCHEMA_VERSION
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

export type MapachessPlayerDataV7 = Readonly<
  Omit<MapachessPlayerDataV6, "schemaVersion" | "ratings"> & {
    schemaVersion: typeof TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION
    legacyRatings: LegacyPlayerEloRatings
    processedMatchResultIds: readonly string[]
    ratedMatchCounts: RatedMatchCounts
    ratings: PlayerEloRatings
  }
>

export type AcceptedMatchReward = Readonly<{
  contribution?: Readonly<{
    applied: boolean
    ending: Readonly<{
      conclusion: MatchConclusion
      cursor: number
      currentFen: string
      moveIds: readonly MatchMoveId[]
    }>
    variant: MatchVariant
    opponentId: StockfishOpponentId
    challengeOutcome: "win" | "loss" | null
    ratedMatchCountBefore: number | null
    eloState: "active" | "superseded" | "rebase"
  }>
  matchId: string
  awardedXp: number
  totalXpBefore: number
  unlockedAchievementIds: readonly LevelAchievementId[]
  ratedElo: Readonly<{
    variant: MatchVariant
    before: number
    after: number
  }> | null
}>

export const acceptedRewardMatchesEnding = (
  reward: AcceptedMatchReward | null,
  match: DurableMatchRecord,
): boolean =>
  reward !== null &&
  reward.matchId === match.matchId &&
  match.conclusion !== null &&
  (reward.contribution === undefined ||
    (reward.contribution.applied &&
      reward.contribution.ending.cursor === match.cursor &&
      reward.contribution.ending.currentFen === match.currentFen &&
      reward.contribution.ending.moveIds.length === match.cursor &&
      reward.contribution.ending.moveIds.every(
        (id, index) => id === match.moveIds[index],
      ) &&
      reward.contribution.ending.conclusion.type === match.conclusion.type &&
      (!("winner" in reward.contribution.ending.conclusion) ||
        ("winner" in match.conclusion &&
          reward.contribution.ending.conclusion.winner ===
            match.conclusion.winner))))

export type MapachessPlayerData = Readonly<
  Omit<MapachessPlayerDataV7, "schemaVersion" | "settings"> & {
    schemaVersion: typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
    settings: MapachessPlayerDataV7["settings"] &
      Readonly<{
        chessAppearance: ChessAppearanceSettings
        coachCollection: CoachCollectionId
      }>
    totalXp: number
    unlockedAchievementIds: readonly LevelAchievementId[]
    lastAcceptedResultReward: AcceptedMatchReward | null
    appearance: PlayerAppearance
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
    appearance: DEFAULT_PLAYER_APPEARANCE,
    challengeHistory: createInitialChallengeHistory(),
    legacyRatings: createInitialLegacyPlayerEloRatings(),
    lastAcceptedResultReward: null,
    processedMatchResultIds: Object.freeze([]),
    ratedMatchCounts: createInitialRatedMatchCounts(),
    ratings: createInitialPlayerEloRatings(),
    revision: 0,
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    storyProgress: createInitialStoryProgress(),
    totalXp: 0,
    unlockedAchievementIds: Object.freeze([]),
    settings: Object.freeze({
      autoHintMode: DEFAULT_AUTO_HINT_MODE,
      challengeSetup: DEFAULT_CHALLENGE_SETUP,
      chessAppearance: DEFAULT_CHESS_APPEARANCE,
      coachCollection: DEFAULT_COACH_COLLECTION,
    }),
  })
}

import {
  AUTO_HINT_MODES,
  autoHintModeFromLegacyEnabled,
} from "@mapachess/match/auto-hint-mode"
import parseChallengeSetup, {
  DEFAULT_CHALLENGE_SETUP,
  parseChallengePositionSetup,
} from "@mapachess/match/challenge-setup"
import { createInitialChallengeHistory } from "./challengeHistory.js"
import decodeChallengeHistory, {
  canonicalChallengeHistory,
} from "./challengeHistoryCodec.js"
import {
  failData,
  PlayerDataDecodeProblem,
  requireBoolean,
  requireEnumValue,
  requireExactKeys,
  requireObject,
  requirePlayerElo,
  requireSafeRevision,
  type JsonObject,
  type PlayerDataDecodeIssue,
} from "./decodePrimitives.js"
import {
  canonicalActiveMatch,
  canonicalLegacyActiveMatch,
  decodeDurableMatch,
} from "./durableMatchCodec.js"
import {
  COMPLETED_MATCH_XP,
  GLOBAL_XP_QUANTUM,
  LEVEL_ACHIEVEMENTS,
  levelAchievementsCrossed,
  levelFromTotalXp,
  STRONGER_CALIBRATED_WIN_BONUS_XP,
  type LevelAchievementId,
} from "./globalXp.js"
import {
  CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION,
  createInitialPlayerEloRatings,
  createInitialRatedMatchCounts,
  INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION,
  LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION,
  LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  LEGACY_PLAYER_ELO_RATING_IDS,
  MAPACHESS_PLAYER_DATA_SCHEMA,
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
  STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION,
  THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION,
  TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION,
  type AcceptedMatchReward,
  type LegacyPlayerEloRatings,
  type MapachessPlayerData,
  type MapachessPlayerDataV1,
  type MapachessPlayerDataV6,
  type MapachessPlayerDataV7,
  type PlayerEloRatings,
  type RatedMatchCounts,
} from "./playerData.js"
import applyStoryMatchResult, {
  createInitialStoryProgress,
} from "./storyProgress.js"
import decodeStoryProgress, {
  canonicalStoryProgress,
  requireRecordedStoryResult,
} from "./storyProgressCodec.js"

export type { PlayerDataDecodeIssue } from "./decodePrimitives.js"

export type PlayerDataDecodeResult =
  | Readonly<{ data: MapachessPlayerData; ok: true }>
  | Readonly<{ issue: PlayerDataDecodeIssue; ok: false }>

export type PlayerDataSource = Readonly<{
  canonical: string
  schemaVersion:
    | typeof LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
    | typeof THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
    | typeof CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION
    | typeof STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
    | typeof INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION
    | typeof LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION
    | typeof TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION
    | typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
}>

export type PlayerDataDecodeWithSourceResult =
  | Readonly<{
      data: MapachessPlayerData
      ok: true
      source: PlayerDataSource
    }>
  | Readonly<{ issue: PlayerDataDecodeIssue; ok: false }>

const decodeLegacyPlayerEloRatings = (
  received: unknown,
  path: string,
): LegacyPlayerEloRatings => {
  const object = requireObject(received, path)
  requireExactKeys(object, LEGACY_PLAYER_ELO_RATING_IDS, path)
  return Object.freeze({
    chess960Challenge: requirePlayerElo(
      object.chess960Challenge,
      `${path}.chess960Challenge`,
    ),
    chess960Story: requirePlayerElo(
      object.chess960Story,
      `${path}.chess960Story`,
    ),
    standardChallenge: requirePlayerElo(
      object.standardChallenge,
      `${path}.standardChallenge`,
    ),
    standardStory: requirePlayerElo(
      object.standardStory,
      `${path}.standardStory`,
    ),
  })
}

const decodePlayerEloRatings = (
  received: unknown,
  path: string,
): PlayerEloRatings => {
  const object = requireObject(received, path)
  requireExactKeys(object, PLAYER_ELO_RATING_IDS, path)
  return Object.freeze({
    chess960: requirePlayerElo(object.chess960, `${path}.chess960`),
    standard: requirePlayerElo(object.standard, `${path}.standard`),
  })
}

const decodeRatedMatchCounts = (
  received: unknown,
  path: string,
): RatedMatchCounts => {
  const object = requireObject(received, path)
  requireExactKeys(object, PLAYER_ELO_RATING_IDS, path)
  return Object.freeze({
    chess960: requireSafeRevision(object.chess960, `${path}.chess960`),
    standard: requireSafeRevision(object.standard, `${path}.standard`),
  })
}

const decodeProcessedMatchResultIds = (
  received: unknown,
  path: string,
): readonly string[] => {
  if (!Array.isArray(received)) return failData(path)
  const ids = received.map((value: unknown, index: number) => {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > 256 ||
      value !== value.trim()
    )
      return failData(`${path}[${String(index)}]`)
    return value
  })
  if (new Set(ids).size !== ids.length) return failData(path)
  return Object.freeze(ids)
}

const decodeLevelAchievementIds = (
  received: unknown,
  path: string,
  totalXp: number,
): readonly LevelAchievementId[] => {
  if (!Array.isArray(received)) return failData(path)
  const availableLevel = levelFromTotalXp(totalXp)
  const ids = received.map((value: unknown, index: number) => {
    const achievement = LEVEL_ACHIEVEMENTS.find(({ id }) => id === value)
    if (achievement === undefined || achievement.level > availableLevel) {
      return failData(`${path}[${String(index)}]`)
    }
    return achievement.id
  })
  if (
    new Set(ids).size !== ids.length ||
    ids.some(
      (id, index) =>
        index > 0 &&
        LEVEL_ACHIEVEMENTS.findIndex((entry) => entry.id === ids[index - 1]) >=
          LEVEL_ACHIEVEMENTS.findIndex((entry) => entry.id === id),
    )
  ) {
    return failData(path)
  }
  return Object.freeze(ids)
}

const decodeAcceptedMatchReward = (
  received: unknown,
  totalXp: number,
  processedMatchResultIds: readonly string[],
): AcceptedMatchReward | null => {
  if (received === null) return null
  const path = "$.lastAcceptedResultReward"
  const object = requireObject(received, path)
  requireExactKeys(
    object,
    [
      "matchId",
      "awardedXp",
      "totalXpBefore",
      "unlockedAchievementIds",
      "ratedElo",
    ],
    path,
  )
  if (
    typeof object.matchId !== "string" ||
    !processedMatchResultIds.includes(object.matchId)
  ) {
    return failData(`${path}.matchId`)
  }
  const awardedXp = requireSafeRevision(object.awardedXp, `${path}.awardedXp`)
  const totalXpBefore = requireSafeRevision(
    object.totalXpBefore,
    `${path}.totalXpBefore`,
  )
  if (
    (awardedXp !== COMPLETED_MATCH_XP &&
      awardedXp !== COMPLETED_MATCH_XP + STRONGER_CALIBRATED_WIN_BONUS_XP) ||
    totalXpBefore + awardedXp !== totalXp
  ) {
    return failData(path)
  }
  const unlockedAchievementIds = decodeLevelAchievementIds(
    object.unlockedAchievementIds,
    `${path}.unlockedAchievementIds`,
    totalXp,
  )
  const expectedUnlocks = levelAchievementsCrossed(totalXpBefore, totalXp)
  if (
    unlockedAchievementIds.length !== expectedUnlocks.length ||
    unlockedAchievementIds.some((id, index) => id !== expectedUnlocks[index])
  ) {
    return failData(`${path}.unlockedAchievementIds`)
  }
  let ratedElo: AcceptedMatchReward["ratedElo"] = null
  if (object.ratedElo !== null) {
    const rated = requireObject(object.ratedElo, `${path}.ratedElo`)
    requireExactKeys(rated, ["variant", "before", "after"], `${path}.ratedElo`)
    ratedElo = Object.freeze({
      variant: requireEnumValue(
        rated.variant,
        PLAYER_ELO_RATING_IDS,
        `${path}.ratedElo.variant`,
      ),
      before: requirePlayerElo(rated.before, `${path}.ratedElo.before`),
      after: requirePlayerElo(rated.after, `${path}.ratedElo.after`),
    })
  }
  return Object.freeze({
    matchId: object.matchId,
    awardedXp,
    totalXpBefore,
    unlockedAchievementIds,
    ratedElo,
  })
}

const migrateFourRatings = (data: MapachessPlayerDataV6): MapachessPlayerData =>
  Object.freeze({
    ...data,
    legacyRatings: data.ratings,
    lastAcceptedResultReward: null,
    processedMatchResultIds: Object.freeze(
      data.activeMatch?.conclusion === null || data.activeMatch === null
        ? []
        : [data.activeMatch.matchId],
    ),
    ratedMatchCounts: createInitialRatedMatchCounts(),
    ratings: createInitialPlayerEloRatings(),
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    totalXp: 0,
    unlockedAchievementIds: Object.freeze([]),
  })

const canonicalLegacyPlayerData = (data: MapachessPlayerDataV1): string =>
  JSON.stringify([
    data.schema,
    data.schemaVersion,
    data.revision,
    data.firstRun.autoHintsChoiceCompleted,
    data.settings.autoHintsEnabled,
    LEGACY_PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
    data.activeMatch === null
      ? null
      : canonicalLegacyActiveMatch(data.activeMatch),
  ])

const canonicalModernPlayerData = (
  data: MapachessPlayerDataV6,
  sourceSchemaVersion:
    | typeof THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
    | typeof CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION
    | typeof STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
    | typeof INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION
    | typeof LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION,
): string => {
  const fields: readonly unknown[] = [
    data.schema,
    sourceSchemaVersion,
    data.revision,
    data.settings.autoHintMode,
    LEGACY_PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
    data.activeMatch === null ? null : canonicalActiveMatch(data.activeMatch),
  ]
  return JSON.stringify(
    sourceSchemaVersion === THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
      ? fields
      : [
          ...fields,
          [
            data.settings.challengeSetup.variant,
            data.settings.challengeSetup.playerColor,
            data.settings.challengeSetup.chess960PositionId,
            ...(sourceSchemaVersion >=
            INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION
              ? [
                  data.settings.challengeSetup.opponentId,
                  data.settings.challengeSetup.difficultyTargetElo,
                ]
              : []),
          ],
          ...(sourceSchemaVersion >= STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
            ? [canonicalStoryProgress(data.storyProgress)]
            : []),
          ...(sourceSchemaVersion ===
          LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION
            ? [canonicalChallengeHistory(data.challengeHistory)]
            : []),
        ],
  )
}

const canonicalTwoVariantFields = (
  data: MapachessPlayerDataV7 | MapachessPlayerData,
): readonly unknown[] => [
  data.schema,
  data.schemaVersion,
  data.revision,
  data.settings.autoHintMode,
  PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
  data.activeMatch === null ? null : canonicalActiveMatch(data.activeMatch),
  [
    data.settings.challengeSetup.variant,
    data.settings.challengeSetup.playerColor,
    data.settings.challengeSetup.chess960PositionId,
    data.settings.challengeSetup.opponentId,
    data.settings.challengeSetup.difficultyTargetElo,
  ],
  canonicalStoryProgress(data.storyProgress),
  canonicalChallengeHistory(data.challengeHistory),
  LEGACY_PLAYER_ELO_RATING_IDS.map((ratingId) => data.legacyRatings[ratingId]),
  PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratedMatchCounts[ratingId]),
  data.processedMatchResultIds,
]

const canonicalTwoVariantPlayerData = (data: MapachessPlayerDataV7): string =>
  JSON.stringify(canonicalTwoVariantFields(data))

export const canonicalPlayerData = (data: MapachessPlayerData): string =>
  JSON.stringify([
    ...canonicalTwoVariantFields(data),
    data.totalXp,
    data.unlockedAchievementIds,
    data.lastAcceptedResultReward === null
      ? null
      : [
          data.lastAcceptedResultReward.matchId,
          data.lastAcceptedResultReward.awardedXp,
          data.lastAcceptedResultReward.totalXpBefore,
          data.lastAcceptedResultReward.unlockedAchievementIds,
          data.lastAcceptedResultReward.ratedElo === null
            ? null
            : [
                data.lastAcceptedResultReward.ratedElo.variant,
                data.lastAcceptedResultReward.ratedElo.before,
                data.lastAcceptedResultReward.ratedElo.after,
              ],
        ],
  ])

const decodeLegacyPlayerData = (
  object: JsonObject,
): Readonly<{ data: MapachessPlayerData; source: PlayerDataSource }> => {
  requireExactKeys(
    object,
    [
      "activeMatch",
      "firstRun",
      "ratings",
      "revision",
      "schema",
      "schemaVersion",
      "settings",
    ],
    "$",
  )
  const firstRun = requireObject(object.firstRun, "$.firstRun")
  requireExactKeys(firstRun, ["autoHintsChoiceCompleted"], "$.firstRun")
  const settings = requireObject(object.settings, "$.settings")
  requireExactKeys(settings, ["autoHintsEnabled"], "$.settings")
  const activeMatch =
    object.activeMatch === null
      ? null
      : decodeDurableMatch(object.activeMatch, "$.activeMatch")
  const legacyData: MapachessPlayerDataV1 = Object.freeze({
    activeMatch,
    firstRun: Object.freeze({
      autoHintsChoiceCompleted: requireBoolean(
        firstRun.autoHintsChoiceCompleted,
        "$.firstRun.autoHintsChoiceCompleted",
      ),
    }),
    ratings: decodeLegacyPlayerEloRatings(object.ratings, "$.ratings"),
    revision: requireSafeRevision(object.revision, "$.revision"),
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    settings: Object.freeze({
      autoHintsEnabled: requireBoolean(
        settings.autoHintsEnabled,
        "$.settings.autoHintsEnabled",
      ),
    }),
  })

  return Object.freeze({
    data: migrateFourRatings(
      Object.freeze({
        activeMatch,
        challengeHistory: createInitialChallengeHistory(),
        ratings: legacyData.ratings,
        revision: legacyData.revision,
        schema: MAPACHESS_PLAYER_DATA_SCHEMA,
        schemaVersion: LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION,
        storyProgress: applyStoryMatchResult(
          createInitialStoryProgress(),
          activeMatch,
        ),
        settings: Object.freeze({
          challengeSetup: DEFAULT_CHALLENGE_SETUP,
          autoHintMode: autoHintModeFromLegacyEnabled(
            legacyData.settings.autoHintsEnabled,
          ),
        }),
      }),
    ),
    source: Object.freeze({
      canonical: canonicalLegacyPlayerData(legacyData),
      schemaVersion: LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    }),
  })
}

const decodeModernPlayerData = (
  object: JsonObject,
  sourceSchemaVersion:
    | typeof THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
    | typeof CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION
    | typeof STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
    | typeof INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION
    | typeof LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION,
): Readonly<{ data: MapachessPlayerData; source: PlayerDataSource }> => {
  requireExactKeys(
    object,
    [
      "activeMatch",
      "ratings",
      "revision",
      "schema",
      "schemaVersion",
      "settings",
      ...(sourceSchemaVersion >= STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
        ? ["storyProgress"]
        : []),
      ...(sourceSchemaVersion === LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION
        ? ["challengeHistory"]
        : []),
    ],
    "$",
  )
  const settings = requireObject(object.settings, "$.settings")
  requireExactKeys(
    settings,
    sourceSchemaVersion === THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
      ? ["autoHintMode"]
      : ["autoHintMode", "challengeSetup"],
    "$.settings",
  )
  const challengeSetup =
    sourceSchemaVersion === THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
      ? { ok: true as const, setup: DEFAULT_CHALLENGE_SETUP }
      : sourceSchemaVersion >= INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION
        ? parseChallengeSetup(settings.challengeSetup)
        : parseChallengePositionSetup(settings.challengeSetup)
  if (!challengeSetup.ok) return failData("$.settings.challengeSetup")
  const activeMatch =
    object.activeMatch === null
      ? null
      : decodeDurableMatch(object.activeMatch, "$.activeMatch")
  const storyProgress =
    sourceSchemaVersion >= STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION
      ? decodeStoryProgress(object.storyProgress, "$.storyProgress")
      : applyStoryMatchResult(createInitialStoryProgress(), activeMatch)
  requireRecordedStoryResult(storyProgress, activeMatch)
  const data: MapachessPlayerDataV6 = Object.freeze({
    activeMatch,
    challengeHistory:
      sourceSchemaVersion === LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION
        ? decodeChallengeHistory(object.challengeHistory, "$.challengeHistory")
        : createInitialChallengeHistory(),
    ratings: decodeLegacyPlayerEloRatings(object.ratings, "$.ratings"),
    revision: requireSafeRevision(object.revision, "$.revision"),
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION,
    storyProgress,
    settings: Object.freeze({
      challengeSetup: Object.freeze({
        ...DEFAULT_CHALLENGE_SETUP,
        ...challengeSetup.setup,
      }),
      autoHintMode: requireEnumValue(
        settings.autoHintMode,
        AUTO_HINT_MODES,
        "$.settings.autoHintMode",
      ),
    }),
  })

  return Object.freeze({
    data: migrateFourRatings(data),
    source: Object.freeze({
      canonical: canonicalModernPlayerData(data, sourceSchemaVersion),
      schemaVersion: sourceSchemaVersion,
    }),
  })
}

const decodeCurrentPlayerData = (
  object: JsonObject,
  sourceSchemaVersion:
    | typeof TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION
    | typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
): Readonly<{ data: MapachessPlayerData; source: PlayerDataSource }> => {
  requireExactKeys(
    object,
    [
      "activeMatch",
      "challengeHistory",
      "legacyRatings",
      "processedMatchResultIds",
      "ratedMatchCounts",
      "ratings",
      "revision",
      "schema",
      "schemaVersion",
      "settings",
      "storyProgress",
      ...(sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
        ? ["totalXp", "unlockedAchievementIds", "lastAcceptedResultReward"]
        : []),
    ],
    "$",
  )
  const settings = requireObject(object.settings, "$.settings")
  requireExactKeys(settings, ["autoHintMode", "challengeSetup"], "$.settings")
  const challengeSetup = parseChallengeSetup(settings.challengeSetup)
  if (!challengeSetup.ok) return failData("$.settings.challengeSetup")
  const activeMatch =
    object.activeMatch === null
      ? null
      : decodeDurableMatch(object.activeMatch, "$.activeMatch")
  const storyProgress = decodeStoryProgress(
    object.storyProgress,
    "$.storyProgress",
  )
  requireRecordedStoryResult(storyProgress, activeMatch)
  const processedMatchResultIds = decodeProcessedMatchResultIds(
    object.processedMatchResultIds,
    "$.processedMatchResultIds",
  )
  if (
    activeMatch?.conclusion !== null &&
    activeMatch !== null &&
    !processedMatchResultIds.includes(activeMatch.matchId)
  ) {
    return failData("$.processedMatchResultIds")
  }
  const totalXp =
    sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
      ? requireSafeRevision(object.totalXp, "$.totalXp")
      : 0
  if (totalXp % GLOBAL_XP_QUANTUM !== 0) {
    return failData("$.totalXp")
  }
  const unlockedAchievementIds =
    sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
      ? decodeLevelAchievementIds(
          object.unlockedAchievementIds,
          "$.unlockedAchievementIds",
          totalXp,
        )
      : Object.freeze([])
  const lastAcceptedResultReward =
    sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
      ? decodeAcceptedMatchReward(
          object.lastAcceptedResultReward,
          totalXp,
          processedMatchResultIds,
        )
      : null
  const data: MapachessPlayerData = Object.freeze({
    activeMatch,
    challengeHistory: decodeChallengeHistory(
      object.challengeHistory,
      "$.challengeHistory",
    ),
    legacyRatings: decodeLegacyPlayerEloRatings(
      object.legacyRatings,
      "$.legacyRatings",
    ),
    lastAcceptedResultReward,
    processedMatchResultIds,
    ratedMatchCounts: decodeRatedMatchCounts(
      object.ratedMatchCounts,
      "$.ratedMatchCounts",
    ),
    ratings: decodePlayerEloRatings(object.ratings, "$.ratings"),
    revision: requireSafeRevision(object.revision, "$.revision"),
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    settings: Object.freeze({
      autoHintMode: requireEnumValue(
        settings.autoHintMode,
        AUTO_HINT_MODES,
        "$.settings.autoHintMode",
      ),
      challengeSetup: challengeSetup.setup,
    }),
    storyProgress,
    totalXp,
    unlockedAchievementIds,
  })
  return Object.freeze({
    data,
    source: Object.freeze({
      canonical:
        sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
          ? canonicalPlayerData(data)
          : canonicalTwoVariantPlayerData({
              ...data,
              schemaVersion: TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION,
            }),
      schemaVersion: sourceSchemaVersion,
    }),
  })
}

export const decodeMapachessPlayerDataWithSource = (
  received: unknown,
): PlayerDataDecodeWithSourceResult => {
  try {
    const object = requireObject(received, "$")
    if (object.schema !== MAPACHESS_PLAYER_DATA_SCHEMA) failData("$.schema")
    if (
      typeof object.schemaVersion === "number" &&
      object.schemaVersion > MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
    ) {
      throw new PlayerDataDecodeProblem({
        receivedVersion: object.schemaVersion,
        type: "PROFILE.SCHEMA_VERSION_UNSUPPORTED",
      })
    }

    const decoded =
      object.schemaVersion === LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
        ? decodeLegacyPlayerData(object)
        : object.schemaVersion ===
              THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION ||
            object.schemaVersion ===
              CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION ||
            object.schemaVersion ===
              STORY_PROGRESS_PLAYER_DATA_SCHEMA_VERSION ||
            object.schemaVersion ===
              INDEPENDENT_CHALLENGE_PLAYER_DATA_SCHEMA_VERSION ||
            object.schemaVersion ===
              LEGACY_FOUR_RATINGS_PLAYER_DATA_SCHEMA_VERSION
          ? decodeModernPlayerData(object, object.schemaVersion)
          : object.schemaVersion === TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION ||
              object.schemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
            ? decodeCurrentPlayerData(object, object.schemaVersion)
            : failData("$.schemaVersion")
    return { ...decoded, ok: true }
  } catch (error) {
    if (error instanceof PlayerDataDecodeProblem) {
      return { issue: error.issue, ok: false }
    }
    throw error
  }
}

export const decodeMapachessPlayerData = (
  received: unknown,
): PlayerDataDecodeResult => {
  const result = decodeMapachessPlayerDataWithSource(received)
  return result.ok ? { data: result.data, ok: true } : result
}

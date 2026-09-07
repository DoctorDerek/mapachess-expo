import {
  AUTO_HINT_MODES,
  autoHintModeFromLegacyEnabled,
} from "@mapachess/match/auto-hint-mode"
import parseChallengeSetup, {
  DEFAULT_CHALLENGE_SETUP,
} from "@mapachess/match/challenge-setup"
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
  CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION,
  LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  MAPACHESS_PLAYER_DATA_SCHEMA,
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
  THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION,
  type MapachessPlayerData,
  type MapachessPlayerDataV1,
  type PlayerEloRatings,
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
    | typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
}>

export type PlayerDataDecodeWithSourceResult =
  | Readonly<{
      data: MapachessPlayerData
      ok: true
      source: PlayerDataSource
    }>
  | Readonly<{ issue: PlayerDataDecodeIssue; ok: false }>

const decodePlayerEloRatings = (
  received: unknown,
  path: string,
): PlayerEloRatings => {
  const object = requireObject(received, path)
  requireExactKeys(object, PLAYER_ELO_RATING_IDS, path)
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

const canonicalLegacyPlayerData = (data: MapachessPlayerDataV1): string =>
  JSON.stringify([
    data.schema,
    data.schemaVersion,
    data.revision,
    data.firstRun.autoHintsChoiceCompleted,
    data.settings.autoHintsEnabled,
    PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
    data.activeMatch === null
      ? null
      : canonicalLegacyActiveMatch(data.activeMatch),
  ])

const canonicalModernPlayerData = (
  data: MapachessPlayerData,
  sourceSchemaVersion:
    | typeof THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
    | typeof CHALLENGE_SETUP_PLAYER_DATA_SCHEMA_VERSION
    | typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
): string => {
  const fields: readonly unknown[] = [
    data.schema,
    sourceSchemaVersion,
    data.revision,
    data.settings.autoHintMode,
    PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
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
          ],
          ...(sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
            ? [canonicalStoryProgress(data.storyProgress)]
            : []),
        ],
  )
}

export const canonicalPlayerData = (data: MapachessPlayerData): string =>
  canonicalModernPlayerData(data, MAPACHESS_PLAYER_DATA_SCHEMA_VERSION)

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
    ratings: decodePlayerEloRatings(object.ratings, "$.ratings"),
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
    data: Object.freeze({
      activeMatch,
      ratings: legacyData.ratings,
      revision: legacyData.revision,
      schema: MAPACHESS_PLAYER_DATA_SCHEMA,
      schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
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
    | typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
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
      ...(sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
        ? ["storyProgress"]
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
  const challengeSetup = parseChallengeSetup(
    sourceSchemaVersion === THREE_HINT_MODES_PLAYER_DATA_SCHEMA_VERSION
      ? DEFAULT_CHALLENGE_SETUP
      : settings.challengeSetup,
  )
  if (!challengeSetup.ok) return failData("$.settings.challengeSetup")
  const activeMatch =
    object.activeMatch === null
      ? null
      : decodeDurableMatch(object.activeMatch, "$.activeMatch")
  const storyProgress =
    sourceSchemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
      ? decodeStoryProgress(object.storyProgress, "$.storyProgress")
      : applyStoryMatchResult(createInitialStoryProgress(), activeMatch)
  requireRecordedStoryResult(storyProgress, activeMatch)
  const data: MapachessPlayerData = Object.freeze({
    activeMatch,
    ratings: decodePlayerEloRatings(object.ratings, "$.ratings"),
    revision: requireSafeRevision(object.revision, "$.revision"),
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    storyProgress,
    settings: Object.freeze({
      challengeSetup: challengeSetup.setup,
      autoHintMode: requireEnumValue(
        settings.autoHintMode,
        AUTO_HINT_MODES,
        "$.settings.autoHintMode",
      ),
    }),
  })

  return Object.freeze({
    data,
    source: Object.freeze({
      canonical: canonicalModernPlayerData(data, sourceSchemaVersion),
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
            object.schemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
          ? decodeModernPlayerData(object, object.schemaVersion)
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

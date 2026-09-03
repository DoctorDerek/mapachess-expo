import {
  AUTO_HINT_MODES,
  autoHintModeFromLegacyEnabled,
} from "@mapachess/match/auto-hint-mode"
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
  LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  MAPACHESS_PLAYER_DATA_SCHEMA,
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
  type MapachessPlayerData,
  type MapachessPlayerDataV1,
  type PlayerEloRatings,
} from "./playerData.js"

export type { PlayerDataDecodeIssue } from "./decodePrimitives.js"

export type PlayerDataDecodeResult =
  | Readonly<{ data: MapachessPlayerData; ok: true }>
  | Readonly<{ issue: PlayerDataDecodeIssue; ok: false }>

export type PlayerDataSource = Readonly<{
  canonical: string
  schemaVersion:
    | typeof LEGACY_MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
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

export const canonicalPlayerData = (data: MapachessPlayerData): string =>
  JSON.stringify([
    data.schema,
    data.schemaVersion,
    data.revision,
    data.settings.autoHintMode,
    PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
    data.activeMatch === null ? null : canonicalActiveMatch(data.activeMatch),
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
      settings: Object.freeze({
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

const decodeCurrentPlayerData = (
  object: JsonObject,
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
    ],
    "$",
  )
  const settings = requireObject(object.settings, "$.settings")
  requireExactKeys(settings, ["autoHintMode"], "$.settings")
  const data: MapachessPlayerData = Object.freeze({
    activeMatch:
      object.activeMatch === null
        ? null
        : decodeDurableMatch(object.activeMatch, "$.activeMatch"),
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
    }),
  })

  return Object.freeze({
    data,
    source: Object.freeze({
      canonical: canonicalPlayerData(data),
      schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
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
        : object.schemaVersion === MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
          ? decodeCurrentPlayerData(object)
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

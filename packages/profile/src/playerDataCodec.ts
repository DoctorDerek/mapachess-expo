import {
  failData,
  PlayerDataDecodeProblem,
  requireBoolean,
  requireExactKeys,
  requireObject,
  requirePlayerElo,
  requireSafeRevision,
  type PlayerDataDecodeIssue,
} from "./decodePrimitives.js"
import {
  canonicalActiveMatch,
  decodeDurableMatch,
} from "./durableMatchCodec.js"
import {
  MAPACHESS_PLAYER_DATA_SCHEMA,
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
  type MapachessPlayerData,
  type PlayerEloRatings,
} from "./playerData.js"

export type { PlayerDataDecodeIssue } from "./decodePrimitives.js"

export type PlayerDataDecodeResult =
  | Readonly<{ data: MapachessPlayerData; ok: true }>
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

const decodeCurrentPlayerData = (received: unknown): MapachessPlayerData => {
  const object = requireObject(received, "$")
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
  if (object.schemaVersion !== MAPACHESS_PLAYER_DATA_SCHEMA_VERSION) {
    failData("$.schemaVersion")
  }

  const firstRun = requireObject(object.firstRun, "$.firstRun")
  requireExactKeys(firstRun, ["autoHintsChoiceCompleted"], "$.firstRun")
  const settings = requireObject(object.settings, "$.settings")
  requireExactKeys(settings, ["autoHintsEnabled"], "$.settings")

  return Object.freeze({
    activeMatch:
      object.activeMatch === null
        ? null
        : decodeDurableMatch(object.activeMatch, "$.activeMatch"),
    firstRun: Object.freeze({
      autoHintsChoiceCompleted: requireBoolean(
        firstRun.autoHintsChoiceCompleted,
        "$.firstRun.autoHintsChoiceCompleted",
      ),
    }),
    ratings: decodePlayerEloRatings(object.ratings, "$.ratings"),
    revision: requireSafeRevision(object.revision, "$.revision"),
    schema: MAPACHESS_PLAYER_DATA_SCHEMA,
    schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    settings: Object.freeze({
      autoHintsEnabled: requireBoolean(
        settings.autoHintsEnabled,
        "$.settings.autoHintsEnabled",
      ),
    }),
  })
}

export const decodeMapachessPlayerData = (
  received: unknown,
): PlayerDataDecodeResult => {
  try {
    return { data: decodeCurrentPlayerData(received), ok: true }
  } catch (error) {
    if (error instanceof PlayerDataDecodeProblem) {
      return { issue: error.issue, ok: false }
    }
    throw error
  }
}

export const canonicalPlayerData = (data: MapachessPlayerData): string =>
  JSON.stringify([
    data.schema,
    data.schemaVersion,
    data.revision,
    data.firstRun.autoHintsChoiceCompleted,
    data.settings.autoHintsEnabled,
    PLAYER_ELO_RATING_IDS.map((ratingId) => data.ratings[ratingId]),
    data.activeMatch === null ? null : canonicalActiveMatch(data.activeMatch),
  ])

import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  DURABLE_MATCH_RECORD_VERSION,
  IMPLEMENTED_DURABLE_OPPONENT_IDS,
  MATCH_MODES,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import {
  MATCH_COLORS,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import {
  failData,
  requireBoolean,
  requireEnumValue,
  requireExactKeys,
  requireObject,
  requirePlayerElo,
  requireSafeRevision,
  requireString,
} from "./decodePrimitives.js"

const MAX_DURABLE_MATCH_PLY_COUNT = 20_000
const MAX_FEN_LENGTH = 256
const MATCH_SEED_PATTERN = /^[0-9a-f]{32}$/u

const decodeStartingPosition = (
  received: unknown,
  path: string,
): MatchStartingPosition => {
  const object = requireObject(received, path)
  requireExactKeys(object, ["chess960PositionId", "variant"], path)

  if (object.variant === "standard" && object.chess960PositionId === null) {
    return Object.freeze({ chess960PositionId: null, variant: "standard" })
  }
  if (object.variant === "chess960") {
    const positionId = parseChess960PositionId(object.chess960PositionId)
    if (positionId.ok) {
      return Object.freeze({
        chess960PositionId: positionId.positionId,
        variant: "chess960",
      })
    }
  }
  return failData(path)
}

const decodeMoveIds = (received: unknown, path: string) => {
  if (
    !Array.isArray(received) ||
    received.length > MAX_DURABLE_MATCH_PLY_COUNT
  ) {
    return failData(path)
  }

  return Object.freeze(
    received.map((candidate, index) => {
      const result = parseMatchMoveId(candidate)
      return result.ok ? result.moveId : failData(`${path}[${String(index)}]`)
    }),
  )
}

export const decodeDurableMatch = (
  received: unknown,
  path: string,
): DurableMatchRecord => {
  const object = requireObject(received, path)
  requireExactKeys(
    object,
    [
      "autoHintsEnabledAtStart",
      "currentFen",
      "cursor",
      "matchId",
      "matchSeed",
      "mode",
      "moveHintsUsed",
      "moveIds",
      "opponentId",
      "opponentPolicyFingerprint",
      "pieceHintsUsed",
      "playerColor",
      "playerEloAtStart",
      "recordVersion",
      "startingPosition",
      "timeControl",
    ],
    path,
  )
  if (object.recordVersion !== DURABLE_MATCH_RECORD_VERSION) {
    return failData(`${path}.recordVersion`)
  }

  const moveIds = decodeMoveIds(object.moveIds, `${path}.moveIds`)
  const cursor = requireSafeRevision(object.cursor, `${path}.cursor`)
  if (cursor > moveIds.length) failData(`${path}.cursor`)

  const matchSeed = requireString(object.matchSeed, `${path}.matchSeed`)
  if (!MATCH_SEED_PATTERN.test(matchSeed)) failData(`${path}.matchSeed`)

  const pieceHintsUsed = requireBoolean(
    object.pieceHintsUsed,
    `${path}.pieceHintsUsed`,
  )
  const moveHintsUsed = requireBoolean(
    object.moveHintsUsed,
    `${path}.moveHintsUsed`,
  )
  if (moveHintsUsed && !pieceHintsUsed) failData(`${path}.moveHintsUsed`)

  const timeControl = requireObject(object.timeControl, `${path}.timeControl`)
  requireExactKeys(timeControl, ["type"], `${path}.timeControl`)
  if (timeControl.type !== "untimed") failData(`${path}.timeControl.type`)

  return Object.freeze({
    autoHintsEnabledAtStart: requireBoolean(
      object.autoHintsEnabledAtStart,
      `${path}.autoHintsEnabledAtStart`,
    ),
    currentFen: requireString(
      object.currentFen,
      `${path}.currentFen`,
      MAX_FEN_LENGTH,
    ),
    cursor,
    matchId: requireString(object.matchId, `${path}.matchId`),
    matchSeed,
    mode: requireEnumValue(object.mode, MATCH_MODES, `${path}.mode`),
    moveHintsUsed,
    moveIds,
    opponentId: requireEnumValue(
      object.opponentId,
      IMPLEMENTED_DURABLE_OPPONENT_IDS,
      `${path}.opponentId`,
    ),
    opponentPolicyFingerprint: requireString(
      object.opponentPolicyFingerprint,
      `${path}.opponentPolicyFingerprint`,
    ),
    pieceHintsUsed,
    playerColor: requireEnumValue(
      object.playerColor,
      MATCH_COLORS,
      `${path}.playerColor`,
    ),
    playerEloAtStart: requirePlayerElo(
      object.playerEloAtStart,
      `${path}.playerEloAtStart`,
    ),
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition: decodeStartingPosition(
      object.startingPosition,
      `${path}.startingPosition`,
    ),
    timeControl: Object.freeze({ type: "untimed" }),
  })
}

export const canonicalActiveMatch = (match: DurableMatchRecord) => [
  match.recordVersion,
  match.matchId,
  match.matchSeed,
  match.mode,
  match.opponentId,
  match.opponentPolicyFingerprint,
  match.playerColor,
  match.playerEloAtStart,
  [match.startingPosition.variant, match.startingPosition.chess960PositionId],
  match.timeControl.type,
  match.autoHintsEnabledAtStart,
  match.moveIds,
  match.cursor,
  match.currentFen,
  match.pieceHintsUsed,
  match.moveHintsUsed,
]

import {
  AUTO_HINT_MODES,
  autoHintModeFromLegacyEnabled,
} from "@mapachess/match/auto-hint-mode"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import {
  DURABLE_MATCH_RECORD_VERSION,
  IMPLEMENTED_DURABLE_OPPONENT_IDS,
  LEGACY_DURABLE_MATCH_RECORD_VERSION,
  LEGACY_DURABLE_MATCH_RECORD_VERSION_2,
  MATCH_MODES,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import {
  conclusionMatchesRetainedBranch,
  deriveRetainedBranchConclusion,
  type MatchConclusion,
} from "@mapachess/match/match-conclusion"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import {
  MATCH_COLORS,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
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

const DURABLE_MATCH_COMMON_KEYS = [
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
  "startingPosition",
  "timeControl",
] as const

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

const decodeConclusion = (
  received: unknown,
  path: string,
): MatchConclusion | null => {
  if (received === null) return null

  const object = requireObject(received, path)
  switch (object.type) {
    case "checkmate":
    case "resignation":
      requireExactKeys(object, ["type", "winner"], path)
      return Object.freeze({
        type: object.type,
        winner: requireEnumValue(object.winner, MATCH_COLORS, `${path}.winner`),
      })
    case "draw-agreement":
    case "insufficient-material":
    case "stalemate":
      requireExactKeys(object, ["type"], path)
      return Object.freeze({ type: object.type })
    default:
      return failData(`${path}.type`)
  }
}

const requireReconstructableTimeline = (
  record: DurableMatchRecord,
  path: string,
): MatchTimeline => {
  const reconstruction = reconstructDurableMatch(record)
  if (reconstruction.ok) return reconstruction.timeline

  switch (reconstruction.error.type) {
    case "MATCH.DURABLE_CURSOR_INVALID":
      return failData(`${path}.cursor`)
    case "MATCH.DURABLE_CURRENT_FEN_MISMATCH":
      return failData(`${path}.currentFen`)
    case "MATCH.DURABLE_MOVE_ILLEGAL":
      return failData(
        `${path}.moveIds[${String(reconstruction.error.moveIndex)}]`,
      )
  }
}

export const decodeDurableMatch = (
  received: unknown,
  path: string,
): DurableMatchRecord => {
  const object = requireObject(received, path)
  const legacyRecord =
    object.recordVersion === LEGACY_DURABLE_MATCH_RECORD_VERSION
  const legacyRecordV2 =
    object.recordVersion === LEGACY_DURABLE_MATCH_RECORD_VERSION_2
  const currentRecord = object.recordVersion === DURABLE_MATCH_RECORD_VERSION
  if (!legacyRecord && !legacyRecordV2 && !currentRecord) {
    return failData(`${path}.recordVersion`)
  }

  requireExactKeys(
    object,
    currentRecord
      ? [
          ...DURABLE_MATCH_COMMON_KEYS,
          "autoHintMode",
          "conclusion",
          "recordVersion",
        ]
      : legacyRecordV2
        ? [
            ...DURABLE_MATCH_COMMON_KEYS,
            "autoHintsEnabledAtStart",
            "conclusion",
            "recordVersion",
          ]
        : [
            ...DURABLE_MATCH_COMMON_KEYS,
            "autoHintsEnabledAtStart",
            "recordVersion",
          ],
    path,
  )

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

  const recordWithoutConclusion: DurableMatchRecord = Object.freeze({
    autoHintMode: currentRecord
      ? requireEnumValue(
          object.autoHintMode,
          AUTO_HINT_MODES,
          `${path}.autoHintMode`,
        )
      : autoHintModeFromLegacyEnabled(
          requireBoolean(
            object.autoHintsEnabledAtStart,
            `${path}.autoHintsEnabledAtStart`,
          ),
        ),
    conclusion: null,
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
  const timeline = requireReconstructableTimeline(recordWithoutConclusion, path)
  const conclusion = legacyRecord
    ? deriveRetainedBranchConclusion(timeline)
    : decodeConclusion(object.conclusion, `${path}.conclusion`)
  if (
    !conclusionMatchesRetainedBranch(conclusion, timeline) ||
    (conclusion?.type === "resignation" &&
      conclusion.winner === recordWithoutConclusion.playerColor)
  ) {
    return failData(`${path}.conclusion`)
  }

  return Object.freeze({ ...recordWithoutConclusion, conclusion })
}

const canonicalConclusion = (conclusion: MatchConclusion | null) =>
  conclusion?.type === "draw-agreement" || conclusion?.type === "resignation"
    ? conclusion.type === "resignation"
      ? [conclusion.type, conclusion.winner]
      : [conclusion.type]
    : null

const canonicalActiveMatchFields = (match: DurableMatchRecord) => [
  match.matchId,
  match.matchSeed,
  match.mode,
  match.opponentId,
  match.opponentPolicyFingerprint,
  match.playerColor,
  match.playerEloAtStart,
  [match.startingPosition.variant, match.startingPosition.chess960PositionId],
  match.timeControl.type,
]

export const canonicalLegacyActiveMatch = (match: DurableMatchRecord) => {
  const voluntaryConclusion = canonicalConclusion(match.conclusion)
  return [
    voluntaryConclusion === null
      ? LEGACY_DURABLE_MATCH_RECORD_VERSION
      : LEGACY_DURABLE_MATCH_RECORD_VERSION_2,
    ...canonicalActiveMatchFields(match),
    match.autoHintMode !== "no-auto-hints",
    match.moveIds,
    match.cursor,
    match.currentFen,
    match.pieceHintsUsed,
    match.moveHintsUsed,
    ...(voluntaryConclusion === null ? [] : [voluntaryConclusion]),
  ]
}

export const canonicalActiveMatch = (match: DurableMatchRecord) => [
  match.recordVersion,
  ...canonicalActiveMatchFields(match),
  match.autoHintMode,
  match.moveIds,
  match.cursor,
  match.currentFen,
  match.pieceHintsUsed,
  match.moveHintsUsed,
  canonicalConclusion(match.conclusion),
]

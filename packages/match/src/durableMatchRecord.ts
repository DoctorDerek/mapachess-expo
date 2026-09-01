import type { MatchConclusion } from "./matchConclusion.js"
import type { MatchMoveId } from "./matchMove.js"
import type { MatchColor, MatchStartingPosition } from "./matchPosition.js"

export const MATCH_MODES = ["story", "challenge"] as const
export const IMPLEMENTED_DURABLE_OPPONENT_IDS = ["chicken-stockfish"] as const
export const LEGACY_DURABLE_MATCH_RECORD_VERSION = 1 as const
export const DURABLE_MATCH_RECORD_VERSION = 2 as const

export type MatchMode = (typeof MATCH_MODES)[number]
export type ImplementedDurableOpponentId =
  (typeof IMPLEMENTED_DURABLE_OPPONENT_IDS)[number]

type DurableMatchRecordFields = Readonly<{
  autoHintsEnabledAtStart: boolean
  currentFen: string
  cursor: number
  matchId: string
  matchSeed: string
  mode: MatchMode
  moveHintsUsed: boolean
  moveIds: readonly MatchMoveId[]
  opponentId: ImplementedDurableOpponentId
  opponentPolicyFingerprint: string
  pieceHintsUsed: boolean
  playerColor: MatchColor
  playerEloAtStart: number
  startingPosition: MatchStartingPosition
  timeControl: Readonly<{ type: "untimed" }>
}>

export type DurableMatchRecordV1 = DurableMatchRecordFields &
  Readonly<{
    recordVersion: typeof LEGACY_DURABLE_MATCH_RECORD_VERSION
  }>

export type DurableMatchRecordV2 = DurableMatchRecordFields &
  Readonly<{
    conclusion: MatchConclusion | null
    recordVersion: typeof DURABLE_MATCH_RECORD_VERSION
  }>

export type DurableMatchRecord = DurableMatchRecordV2

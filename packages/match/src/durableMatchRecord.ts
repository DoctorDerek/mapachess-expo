import type { AutoHintMode } from "./autoHintMode.js"
import type { MatchClockRecord } from "./matchClock.js"
import type {
  MatchConclusion,
  RetainedMatchConclusion,
} from "./matchConclusion.js"
import type { MatchMoveId } from "./matchMove.js"
import type { MatchColor, MatchStartingPosition } from "./matchPosition.js"
import type { MoveFeedbackRecord } from "./moveFeedback.js"
import {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "./stockfishOpponent.js"
import type { TimeControl } from "./timeControl.js"

export const MATCH_MODES = ["story", "challenge"] as const
export const IMPLEMENTED_DURABLE_OPPONENT_IDS = Object.freeze(
  STOCKFISH_OPPONENTS.map(({ id }) => id),
)
export const LEGACY_DURABLE_MATCH_RECORD_VERSION = 1 as const
export const LEGACY_DURABLE_MATCH_RECORD_VERSION_2 = 2 as const
export const LEGACY_DURABLE_MATCH_RECORD_VERSION_3 = 3 as const
export const DURABLE_MATCH_RECORD_VERSION = 4 as const

export type MatchMode = (typeof MATCH_MODES)[number]
export type ImplementedDurableOpponentId = StockfishOpponentId

type DurableMatchRecordFields = Readonly<{
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
  timeControl: TimeControl
  clock?: MatchClockRecord | null
}>

export type DurableMatchRecordV1 = DurableMatchRecordFields &
  Readonly<{
    autoHintsEnabledAtStart: boolean
    recordVersion: typeof LEGACY_DURABLE_MATCH_RECORD_VERSION
  }>

export type DurableMatchRecordV2 = DurableMatchRecordFields &
  Readonly<{
    autoHintsEnabledAtStart: boolean
    conclusion: MatchConclusion | null
    recordVersion: typeof LEGACY_DURABLE_MATCH_RECORD_VERSION_2
  }>

export type DurableMatchRecord = DurableMatchRecordFields &
  Readonly<{
    retainedConclusion?: RetainedMatchConclusion | null
    moveFeedback?: readonly MoveFeedbackRecord[]
    opponentTargetElo?: number
    ratedOpponentElo?: number | null
    autoHintMode: AutoHintMode
    conclusion: MatchConclusion | null
    recordVersion:
      | typeof LEGACY_DURABLE_MATCH_RECORD_VERSION_3
      | typeof DURABLE_MATCH_RECORD_VERSION
  }>

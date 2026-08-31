import type {
  BetterHintsAnalyst,
  BetterHintsRequest,
  BetterHintsResult,
} from "./betterHints.js"
import type {
  AppliedMatchMove,
  LegalMatchMove,
  MatchMoveId,
} from "./matchMove.js"
import type {
  MatchDurability,
  MatchPersistence,
  MatchPersistenceFailure,
  MatchPersistenceRequest,
  PendingMatchMutation,
} from "./matchPersistence.js"
import type { MatchColor, MatchPosition } from "./matchPosition.js"
import type { MatchTimeline } from "./matchTimeline.js"

export type MatchOpponentRequest = Readonly<{
  acceptedMoves: readonly AppliedMatchMove[]
  initialPosition: MatchPosition
  legalMoves: readonly LegalMatchMove[]
  position: MatchPosition
  requestId: string
}>

export type MatchOpponent = Readonly<{
  selectMove: (
    request: MatchOpponentRequest,
    signal: AbortSignal,
  ) => Promise<MatchMoveId>
}>

export type MatchOpponentFailure = Readonly<{
  type: "MATCH.OPPONENT_MOVE_ILLEGAL" | "MATCH.OPPONENT_REQUEST_FAILED"
}>

export type MatchMachineEvent =
  | Readonly<{
      moveId: MatchMoveId
      type: "MATCH.MOVE_REQUESTED"
    }>
  | Readonly<{ type: "MATCH.MOVE_HINTS_REQUESTED" }>
  | Readonly<{ type: "MATCH.OPPONENT_RETRY_REQUESTED" }>
  | Readonly<{ type: "MATCH.PIECE_HINTS_REQUESTED" }>
  | Readonly<{ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" }>
  | Readonly<{ type: "MATCH.UNDO_REQUESTED" }>
  | Readonly<{ type: "MATCH.REDO_REQUESTED" }>

export type MatchMachineInput = Readonly<{
  autoHintsEnabled: boolean
  durability: MatchDurability
  hintAnalyst?: BetterHintsAnalyst
  initialPosition: MatchPosition
  matchId: string
  opponent: MatchOpponent
  playerColor: MatchColor
}>

export type MatchMachineContext = Readonly<{
  autoHintsEnabled: boolean
  durability: MatchDurability
  hintAnalyst: BetterHintsAnalyst | null
  hintFailure: MatchHintFailure | null
  hints: BetterHintsResult | null
  matchId: string
  moveHintsUsed: boolean
  mutationSequence: number
  opponent: MatchOpponent
  opponentFailure: MatchOpponentFailure | null
  pendingMutation: PendingMatchMutation | null
  persistenceFailure: MatchPersistenceFailure | null
  pieceHintsUsed: boolean
  playerColor: MatchColor
  timeline: MatchTimeline
}>

export type MatchHintFailure = Readonly<{
  type: "MATCH.HINT_REQUEST_FAILED"
}>

export type MatchHintStage =
  | "failure"
  | "hidden"
  | "loading"
  | "move-hints"
  | "piece-hints"
  | "ready"
  | "unavailable"

export type MatchOpponentActorInput = Readonly<{
  opponent: MatchOpponent
  request: MatchOpponentRequest
}>

export type MatchHintsActorInput = Readonly<{
  analyst: BetterHintsAnalyst
  request: BetterHintsRequest
}>

export type MatchPersistenceActorInput = Readonly<{
  persistence: MatchPersistence
  request: MatchPersistenceRequest
}>

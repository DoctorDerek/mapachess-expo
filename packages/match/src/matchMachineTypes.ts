import type { AutoHintMode } from "./autoHintMode.js"
import type {
  BetterHintsAnalyst,
  BetterHintsRequest,
  BetterHintsResult,
} from "./betterHints.js"
import type {
  MatchConclusion,
  MatchDrawOfferDecision,
} from "./matchConclusion.js"
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
      autoHintMode: AutoHintMode
      type: "MATCH.AUTO_HINT_MODE_CHANGED"
    }>
  | Readonly<{
      decision: MatchDrawOfferDecision
      type: "MATCH.DRAW_OFFER_REQUESTED"
    }>
  | Readonly<{
      moveId: MatchMoveId
      type: "MATCH.MOVE_REQUESTED"
    }>
  | Readonly<{ type: "MATCH.MOVE_HINTS_REQUESTED" }>
  | Readonly<{ type: "MATCH.OPPONENT_RETRY_REQUESTED" }>
  | Readonly<{ type: "MATCH.PIECE_HINTS_REQUESTED" }>
  | Readonly<{ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" }>
  | Readonly<{ type: "MATCH.RESIGN_REQUESTED" }>
  | Readonly<{ type: "MATCH.UNDO_REQUESTED" }>
  | Readonly<{ type: "MATCH.REDO_REQUESTED" }>

type MatchMachineSharedInput = Readonly<{
  autoHintMode: AutoHintMode
  hintAnalyst?: BetterHintsAnalyst
  matchId: string
  opponent: MatchOpponent
  playerColor: MatchColor
}>

export type ResumedMatchState = Readonly<{
  conclusion: MatchConclusion | null
  moveHintsUsed: boolean
  pieceHintsUsed: boolean
  timeline: MatchTimeline
}>

export type MatchMachineInput =
  | (MatchMachineSharedInput &
      Readonly<{
        durability: MatchDurability
        initialPosition: MatchPosition
      }>)
  | (MatchMachineSharedInput &
      Readonly<{
        durability: Extract<MatchDurability, { type: "durable" }>
        resumedState: ResumedMatchState
      }>)

export type MatchMachineContext = Readonly<{
  autoHintMode: AutoHintMode
  conclusion: MatchConclusion | null
  durability: MatchDurability
  drawOfferResponse: "rejected" | null
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

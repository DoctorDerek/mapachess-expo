import type { AutoHintMode } from "./autoHintMode.js"
import type {
  BetterHintsAnalyst,
  BetterHintsRequest,
  BetterHintsResult,
} from "./betterHints.js"
import {
  conclusionMatchesRetainedBranch,
  deriveRetainedBranchConclusion,
  type MatchConclusion,
} from "./matchConclusion.js"
import type {
  MatchHintFailure,
  MatchMachineContext,
  MatchMachineInput,
  MatchOpponentFailure,
  MatchOpponentRequest,
} from "./matchMachineTypes.js"
import {
  applyMatchMove,
  listLegalMatchMoves,
  type AppliedMatchMove,
  type MatchMoveId,
} from "./matchMove.js"
import {
  createPendingMatchMutation,
  type MatchPersistence,
  type MatchPersistenceFailure,
  type PendingMatchMutation,
} from "./matchPersistence.js"
import type { MatchColor } from "./matchPosition.js"
import {
  applyMatchTimelineMove,
  canRedoMatchTimeline,
  canUndoMatchTimeline,
  createMatchTimeline,
  currentMatchPosition,
  redoMatchTimeline,
  undoMatchTimeline,
  type MatchTimeline,
} from "./matchTimeline.js"

export const createInitialContext = (
  input: MatchMachineInput,
): MatchMachineContext => {
  if (input.matchId.length === 0 || input.matchId !== input.matchId.trim()) {
    throw new TypeError("matchId must be nonempty and trimmed.")
  }

  const resumedState = "resumedState" in input ? input.resumedState : undefined
  if (resumedState?.moveHintsUsed && !resumedState.pieceHintsUsed) {
    throw new TypeError("Resumed Move Hint use requires Piece Hint use.")
  }

  const timeline =
    "initialPosition" in input
      ? createMatchTimeline(input.initialPosition)
      : input.resumedState.timeline
  const pieceHintsUsed = resumedState?.pieceHintsUsed ?? false
  const moveHintsUsed = resumedState?.moveHintsUsed ?? false
  const conclusion =
    resumedState?.conclusion ?? deriveRetainedBranchConclusion(timeline)
  if (!conclusionMatchesRetainedBranch(conclusion, timeline)) {
    throw new TypeError("Match conclusion does not match its retained branch.")
  }

  return {
    autoHintMode: input.autoHintMode,
    conclusion,
    durability: input.durability,
    drawOfferResponse: null,
    hintAnalyst: input.hintAnalyst ?? null,
    hintFailure: null,
    hints: null,
    matchId: input.matchId,
    moveHintsUsed,
    mutationSequence:
      timeline.transitions.length +
      Number(pieceHintsUsed) +
      Number(moveHintsUsed) +
      Number(conclusion !== null),
    opponent: input.opponent,
    opponentFailure: null,
    pendingMutation: null,
    persistenceFailure: null,
    pieceHintsUsed,
    playerColor: input.playerColor,
    timeline,
  }
}

const acceptedMoves = (timeline: MatchTimeline): readonly AppliedMatchMove[] =>
  Object.freeze(
    timeline.transitions
      .slice(0, timeline.cursor)
      .map((transition) => transition.move),
  )

export const createOpponentRequest = (
  context: MatchMachineContext,
): MatchOpponentRequest => {
  const position = currentMatchPosition(context.timeline)

  return Object.freeze({
    acceptedMoves: acceptedMoves(context.timeline),
    initialPosition: context.timeline.initialPosition,
    legalMoves: listLegalMatchMoves(position),
    position,
    requestId: `${context.matchId}/opponent/ply/${String(context.timeline.cursor + 1)}/fen/${position.fen}`,
  })
}

export const createHintsRequest = (
  context: MatchMachineContext,
): BetterHintsRequest => {
  const position = currentMatchPosition(context.timeline)
  return Object.freeze({
    playerColor: context.playerColor,
    position,
    requestId: `${context.matchId}/hints/ply/${String(context.timeline.cursor + 1)}/fen/${position.fen}`,
  })
}

export const requireHintAnalyst = (
  context: MatchMachineContext,
): BetterHintsAnalyst => {
  if (context.hintAnalyst === null) {
    throw new Error("Hint analysis began without an injected analyst.")
  }
  return context.hintAnalyst
}

export const moveIsLegal = (
  timeline: MatchTimeline,
  moveId: MatchMoveId,
): boolean => applyMatchMove(currentMatchPosition(timeline), moveId).ok

export const requireAppliedTimelineMove = (
  timeline: MatchTimeline,
  moveId: MatchMoveId,
): MatchTimeline => {
  const result = applyMatchTimelineMove(timeline, moveId)
  if (!result.ok) {
    throw new Error("A guarded canonical match move became illegal.")
  }
  return result.timeline
}

export const undoToPreviousPlayerDecision = (
  timeline: MatchTimeline,
  playerColor: MatchColor,
): MatchTimeline | undefined => {
  let previousTimeline = timeline

  while (canUndoMatchTimeline(previousTimeline)) {
    const result = undoMatchTimeline(previousTimeline)
    if (!result.ok) return undefined

    previousTimeline = result.timeline
    if (currentMatchPosition(previousTimeline).turn === playerColor) {
      return previousTimeline
    }
  }
  return undefined
}

export const redoToNextPlayerDecision = (
  timeline: MatchTimeline,
  playerColor: MatchColor,
): MatchTimeline | undefined => {
  if (!canRedoMatchTimeline(timeline)) return undefined

  let nextTimeline = timeline
  do {
    const result = redoMatchTimeline(nextTimeline)
    if (!result.ok) return undefined

    nextTimeline = result.timeline
  } while (
    canRedoMatchTimeline(nextTimeline) &&
    currentMatchPosition(nextTimeline).turn !== playerColor
  )
  return nextTimeline
}

export const requireMatchPersistence = (
  context: MatchMachineContext,
): MatchPersistence => {
  if (context.durability.type !== "durable") {
    throw new Error("Durable match mutation requires persistence.")
  }
  return context.durability.persistence
}

export const requirePendingMutation = (
  context: MatchMachineContext,
): PendingMatchMutation => {
  if (context.pendingMutation === null) {
    throw new Error("Persistence state requires a pending match mutation.")
  }
  return context.pendingMutation
}

export const pendingPositionMutation = (
  context: MatchMachineContext,
  timeline: MatchTimeline,
): PendingMatchMutation => {
  const conclusion =
    context.conclusion ?? deriveRetainedBranchConclusion(timeline)
  return createPendingMatchMutation({
    autoHintMode: context.autoHintMode,
    conclusion,
    hints: null,
    matchId: context.matchId,
    moveHintsUsed: context.moveHintsUsed,
    mutationSequence: context.mutationSequence,
    pieceHintsUsed: context.pieceHintsUsed,
    route: conclusion === null ? "resolve-position" : "complete",
    timeline,
  })
}

export const pendingConclusionMutation = (
  context: MatchMachineContext,
  conclusion: MatchConclusion,
): PendingMatchMutation => {
  if (!conclusionMatchesRetainedBranch(conclusion, context.timeline)) {
    throw new TypeError("Requested conclusion does not match the match branch.")
  }

  return createPendingMatchMutation({
    autoHintMode: context.autoHintMode,
    conclusion,
    hints: null,
    matchId: context.matchId,
    moveHintsUsed: context.moveHintsUsed,
    mutationSequence: context.mutationSequence,
    pieceHintsUsed: context.pieceHintsUsed,
    route: "complete",
    timeline: context.timeline,
  })
}

export const pendingAcceptedHintsMutation = (
  context: MatchMachineContext,
  hints: BetterHintsResult,
): PendingMatchMutation => {
  const moveHintsUsed =
    context.moveHintsUsed || context.autoHintMode === "auto-move-hints"

  return createPendingMatchMutation({
    autoHintMode: context.autoHintMode,
    conclusion: context.conclusion,
    hints,
    matchId: context.matchId,
    moveHintsUsed,
    mutationSequence: context.mutationSequence,
    pieceHintsUsed: true,
    route: "accepted-hints-visible",
    timeline: context.timeline,
  })
}

export const pendingMoveHintsMutation = (
  context: MatchMachineContext,
): PendingMatchMutation =>
  createPendingMatchMutation({
    autoHintMode: context.autoHintMode,
    conclusion: context.conclusion,
    hints: context.hints,
    matchId: context.matchId,
    moveHintsUsed: true,
    mutationSequence: context.mutationSequence,
    pieceHintsUsed: context.pieceHintsUsed,
    route: "move-hints-visible",
    timeline: context.timeline,
  })

type AutoHintModeState = Readonly<{
  autoHintMode: AutoHintMode
  hintFailure: null
  hints: BetterHintsResult | null
  moveHintsUsed: boolean
  pieceHintsUsed: boolean
}>

export const autoHintModeState = (
  context: MatchMachineContext,
  autoHintMode: AutoHintMode,
): AutoHintModeState => {
  const hints = autoHintMode === "no-auto-hints" ? null : context.hints
  return {
    autoHintMode,
    hintFailure: null,
    hints,
    moveHintsUsed:
      context.moveHintsUsed ||
      (hints !== null && autoHintMode === "auto-move-hints"),
    pieceHintsUsed:
      context.pieceHintsUsed ||
      (hints !== null && autoHintMode !== "no-auto-hints"),
  }
}

export const pendingAutoHintModeMutation = (
  context: MatchMachineContext,
  autoHintMode: AutoHintMode,
): PendingMatchMutation => {
  const state = autoHintModeState(context, autoHintMode)
  return createPendingMatchMutation({
    autoHintMode: state.autoHintMode,
    conclusion: context.conclusion,
    hints: state.hints,
    matchId: context.matchId,
    moveHintsUsed: state.moveHintsUsed,
    mutationSequence: context.mutationSequence,
    pieceHintsUsed: state.pieceHintsUsed,
    route: context.conclusion === null ? "resolve-position" : "complete",
    timeline: context.timeline,
  })
}

export const acceptedPendingMutation = (
  context: MatchMachineContext,
): Partial<MatchMachineContext> => {
  const pending = requirePendingMutation(context)
  return {
    autoHintMode: pending.request.autoHintMode,
    conclusion: pending.conclusion,
    drawOfferResponse: null,
    hintFailure: null,
    hints: pending.hints,
    moveHintsUsed: pending.moveHintsUsed,
    mutationSequence: context.mutationSequence + 1,
    opponentFailure: null,
    pendingMutation: null,
    persistenceFailure: null,
    pieceHintsUsed: pending.pieceHintsUsed,
    timeline: pending.timeline,
  }
}

export const illegalOpponentMoveFailure = (): MatchOpponentFailure =>
  Object.freeze({ type: "MATCH.OPPONENT_MOVE_ILLEGAL" })

export const opponentRequestFailure = (): MatchOpponentFailure =>
  Object.freeze({ type: "MATCH.OPPONENT_REQUEST_FAILED" })

export const hintRequestFailure = (): MatchHintFailure =>
  Object.freeze({ type: "MATCH.HINT_REQUEST_FAILED" })

export const persistenceRequestFailure = (): MatchPersistenceFailure =>
  Object.freeze({ type: "MATCH.PERSISTENCE_REQUEST_FAILED" })

export const stalePersistenceReceiptFailure = (): MatchPersistenceFailure =>
  Object.freeze({ type: "MATCH.PERSISTENCE_RECEIPT_STALE" })

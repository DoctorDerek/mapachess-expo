import { assign, fromPromise, setup } from "xstate"
import type { BetterHintsResult } from "./betterHints.js"
import {
  pauseMatchClock,
  startMatchClock,
  stopMatchClock,
} from "./matchClock.js"
import matchClockActor from "./matchClockActor.js"
import { pendingClockPause, pendingClockTimeout } from "./matchClockWorkflow.js"
import {
  createDrawAgreementConclusion,
  createPlayerResignationConclusion,
} from "./matchConclusion.js"
import type {
  MatchHintsActorInput,
  MatchMachineContext,
  MatchMachineEvent,
  MatchMachineInput,
  MatchOpponentActorInput,
  MatchPersistenceActorInput,
} from "./matchMachineTypes.js"
import type { MatchMoveId } from "./matchMove.js"
import type { MatchPersistenceReceipt } from "./matchPersistence.js"
import { currentMatchPosition } from "./matchTimeline.js"
import {
  acceptedPendingMutation,
  autoHintModeState,
  moveIsLegal,
  pendingAutoHintModeMutation,
  pendingConclusionMutation,
  pendingMoveHintsMutation,
  pendingPositionMutation,
  redoMatchDecision,
  requireAppliedTimelineMove,
  undoMatchDecision,
} from "./matchWorkflow.js"

const matchCanConclude = (context: MatchMachineContext): boolean =>
  context.conclusion === null &&
  context.pendingMutation === null &&
  currentMatchPosition(context.timeline).status.type === "playing"

const autoHintModeCanChange = (
  context: MatchMachineContext,
  event: MatchMachineEvent,
): boolean =>
  event.type === "MATCH.AUTO_HINT_MODE_CHANGED" &&
  event.autoHintMode !== context.autoHintMode &&
  context.pendingMutation === null

const drawOfferDecisionMatches = (
  context: MatchMachineContext,
  event: MatchMachineEvent,
  outcome: "accepted" | "rejected",
): boolean =>
  event.type === "MATCH.DRAW_OFFER_REQUESTED" &&
  event.decision.outcome === outcome &&
  event.decision.positionFen === currentMatchPosition(context.timeline).fen &&
  currentMatchPosition(context.timeline).turn === context.playerColor &&
  matchCanConclude(context)

const matchMachineSetup = setup({
  types: {
    context: {} as MatchMachineContext,
    events: {} as MatchMachineEvent,
    input: {} as MatchMachineInput,
  },
  actors: {
    clockDeadline: matchClockActor,
    requestHints: fromPromise<BetterHintsResult, MatchHintsActorInput>(
      ({ input, signal }) => input.analyst.analyze(input.request, signal),
    ),
    requestOpponentMove: fromPromise<MatchMoveId, MatchOpponentActorInput>(
      ({ input, signal }) => input.opponent.selectMove(input.request, signal),
    ),
    persistMutation: fromPromise<
      MatchPersistenceReceipt,
      MatchPersistenceActorInput
    >(({ input, signal }) => input.persistence.persist(input.request, signal)),
  },
  actions: {
    startClock: assign(({ context }) => ({
      clock: startMatchClock(context.clock, context.monotonicClock.now()),
    })),
    stopClock: assign(({ context }) => ({
      clock: stopMatchClock(context.clock, context.monotonicClock.now()),
    })),
    pauseClock: assign(({ context }) => ({
      clock: pauseMatchClock(context.clock, context.monotonicClock.now()),
    })),
    resumeClock: assign(({ context }) => ({
      clock:
        context.clock === null ? null : { ...context.clock, paused: false },
    })),
    prepareClockPause: assign(({ context }) => ({
      pendingMutation: pendingClockPause(context),
      persistenceFailure: null,
    })),
    prepareClockTimeout: assign(({ context }) => ({
      pendingMutation: pendingClockTimeout(context),
      persistenceFailure: null,
    })),
    applyClockTimeout: assign(({ context }) =>
      acceptedPendingMutation({
        ...context,
        pendingMutation: pendingClockTimeout(context),
      }),
    ),
    applyAutoHintMode: assign(({ context, event }) => {
      if (event.type !== "MATCH.AUTO_HINT_MODE_CHANGED") {
        throw new Error("Hint-mode action received a non-setting event.")
      }
      return autoHintModeState(context, event.autoHintMode)
    }),
    applyRequestedMove: assign(({ context, event }) => {
      if (event.type !== "MATCH.MOVE_REQUESTED") {
        throw new Error("Move action received a non-move event.")
      }

      const timeline = requireAppliedTimelineMove(
        context.timeline,
        event.moveId,
      )
      return acceptedPendingMutation({
        ...context,
        pendingMutation: pendingPositionMutation(context, timeline),
      })
    }),
    applyAcceptedDrawOffer: assign(({ context }) =>
      acceptedPendingMutation({
        ...context,
        pendingMutation: pendingConclusionMutation(
          context,
          createDrawAgreementConclusion(),
        ),
      }),
    ),
    applyResignation: assign(({ context }) =>
      acceptedPendingMutation({
        ...context,
        pendingMutation: pendingConclusionMutation(
          context,
          createPlayerResignationConclusion(context.playerColor),
        ),
      }),
    ),
    clearOpponentFailure: assign({ opponentFailure: null }),
    clearHintFailure: assign({ hintFailure: null }),
    markDrawOfferRejected: assign({ drawOfferResponse: "rejected" }),
    markMoveHintsUsed: assign({ moveHintsUsed: true }),
    prepareMoveHintsMutation: assign(({ context }) => ({
      pendingMutation: pendingMoveHintsMutation(context),
      persistenceFailure: null,
    })),
    prepareAutoHintModeMutation: assign(({ context, event, self }) => {
      if (event.type !== "MATCH.AUTO_HINT_MODE_CHANGED") {
        throw new Error("Hint-mode persistence received a non-setting event.")
      }
      return {
        pendingMutation: pendingAutoHintModeMutation(
          context,
          event.autoHintMode,
          self.getSnapshot().matches({ playerTurn: "moveHintsVisible" })
            ? "move-hints"
            : self.getSnapshot().matches({ playerTurn: "pieceHintsVisible" })
              ? "piece-hints"
              : null,
        ),
        persistenceFailure: null,
      }
    }),
    prepareAcceptedDrawOfferMutation: assign(({ context }) => ({
      pendingMutation: pendingConclusionMutation(
        context,
        createDrawAgreementConclusion(),
      ),
      persistenceFailure: null,
    })),
    prepareRedoMutation: assign(({ context }) => {
      const timeline = redoMatchDecision(context)
      if (timeline === undefined) {
        throw new Error("Guarded durable Redo became unavailable.")
      }
      return {
        pendingMutation: pendingPositionMutation(context, timeline, "redo"),
        persistenceFailure: null,
      }
    }),
    prepareRequestedMoveMutation: assign(({ context, event }) => {
      if (event.type !== "MATCH.MOVE_REQUESTED") {
        throw new Error("Move persistence received a non-move event.")
      }
      return {
        pendingMutation: pendingPositionMutation(
          context,
          requireAppliedTimelineMove(context.timeline, event.moveId),
        ),
        persistenceFailure: null,
      }
    }),
    prepareResignationMutation: assign(({ context }) => ({
      pendingMutation: pendingConclusionMutation(
        context,
        createPlayerResignationConclusion(context.playerColor),
      ),
      persistenceFailure: null,
    })),
    prepareUndoMutation: assign(({ context }) => {
      const timeline = undoMatchDecision(context)
      if (timeline === undefined) {
        throw new Error("Guarded durable Undo became unavailable.")
      }
      return {
        pendingMutation: pendingPositionMutation(context, timeline, "undo"),
        persistenceFailure: null,
      }
    }),
    redoToPlayerDecision: assign(({ context }) => {
      const timeline = redoMatchDecision(context)

      return timeline === undefined
        ? {}
        : acceptedPendingMutation({
            ...context,
            pendingMutation: pendingPositionMutation(context, timeline, "redo"),
          })
    }),
    undoToPlayerDecision: assign(({ context }) => {
      const timeline = undoMatchDecision(context)

      return timeline === undefined
        ? {}
        : acceptedPendingMutation({
            ...context,
            pendingMutation: pendingPositionMutation(context, timeline, "undo"),
          })
    }),
  },
  guards: {
    acceptedDrawNeedsNoPersistence: ({ context, event }) =>
      context.durability.type === "ephemeral" &&
      drawOfferDecisionMatches(context, event, "accepted"),
    acceptedDrawNeedsPersistence: ({ context, event }) =>
      context.durability.type === "durable" &&
      drawOfferDecisionMatches(context, event, "accepted"),
    autoMoveHintsAreEnabled: ({ context }) =>
      context.autoHintMode === "auto-move-hints",
    autoHintModeChangeNeedsNoPersistence: ({ context, event }) =>
      context.durability.type === "ephemeral" &&
      autoHintModeCanChange(context, event),
    autoHintModeChangeNeedsPersistence: ({ context, event }) =>
      context.durability.type === "durable" &&
      autoHintModeCanChange(context, event),
    canRejectDrawOffer: ({ context, event }) =>
      drawOfferDecisionMatches(context, event, "rejected"),
    canResignEphemerally: ({ context }) =>
      context.durability.type === "ephemeral" && matchCanConclude(context),
    canResignDurably: ({ context }) =>
      context.durability.type === "durable" && matchCanConclude(context),
    isComplete: ({ context }) => context.conclusion !== null,
    isPlayerTurn: ({ context }) =>
      currentMatchPosition(context.timeline).turn === context.playerColor,
    hasHintAnalyst: ({ context }) => context.hintAnalyst !== null,
    moveHintsNeedNoPersistence: ({ context }) =>
      context.durability.type === "ephemeral" || context.moveHintsUsed,
    moveHintsNeedPersistence: ({ context }) =>
      context.durability.type === "durable" && !context.moveHintsUsed,
    canRedoDurably: ({ context }) =>
      context.durability.type === "durable" &&
      redoMatchDecision(context) !== undefined,
    canRedoEphemerally: ({ context }) =>
      context.durability.type === "ephemeral" &&
      redoMatchDecision(context) !== undefined,
    canUndoDurably: ({ context }) =>
      context.durability.type === "durable" &&
      undoMatchDecision(context) !== undefined,
    canUndoEphemerally: ({ context }) =>
      context.durability.type === "ephemeral" &&
      undoMatchDecision(context) !== undefined,
    requestedDurableMoveIsLegal: ({ context, event }) =>
      context.durability.type === "durable" &&
      event.type === "MATCH.MOVE_REQUESTED" &&
      moveIsLegal(context.timeline, event.moveId),
    requestedEphemeralMoveIsLegal: ({ context, event }) =>
      context.durability.type === "ephemeral" &&
      event.type === "MATCH.MOVE_REQUESTED" &&
      moveIsLegal(context.timeline, event.moveId),
    shouldStartAutoHints: ({ context }) =>
      context.autoHintMode !== "no-auto-hints" && context.hintAnalyst !== null,
    shouldShowAcceptedMoveHints: ({ context }) =>
      context.hints !== null && context.autoHintMode === "auto-move-hints",
    shouldShowAcceptedPieceHints: ({ context }) =>
      context.hints !== null && context.autoHintMode === "auto-piece-hints",
  },
})

export default matchMachineSetup

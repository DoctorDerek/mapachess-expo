import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import type { BetterHintsResult } from "./betterHints.js"
import {
  createDrawAgreementConclusion,
  createPlayerResignationConclusion,
  deriveRetainedBranchConclusion,
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
import {
  persistenceReceiptMatches,
  type MatchPersistenceReceipt,
} from "./matchPersistence.js"
import { currentMatchPosition } from "./matchTimeline.js"
import {
  acceptedPendingMutation,
  autoHintModeState,
  createHintsRequest,
  createInitialContext,
  createOpponentRequest,
  hintRequestFailure,
  illegalOpponentMoveFailure,
  moveIsLegal,
  opponentRequestFailure,
  pendingAcceptedHintsMutation,
  pendingAutoHintModeMutation,
  pendingConclusionMutation,
  pendingMoveHintsMutation,
  pendingPositionMutation,
  persistenceRequestFailure,
  redoToNextPlayerDecision,
  requireAppliedTimelineMove,
  requireHintAnalyst,
  requireMatchPersistence,
  requirePendingMutation,
  stalePersistenceReceiptFailure,
  undoToPreviousPlayerDecision,
} from "./matchWorkflow.js"

export type {
  MatchHintFailure,
  MatchHintStage,
  MatchMachineContext,
  MatchMachineEvent,
  MatchMachineInput,
  MatchOpponent,
  MatchOpponentFailure,
  MatchOpponentRequest,
} from "./matchMachineTypes.js"

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

const matchMachineDefinition = setup({
  types: {
    context: {} as MatchMachineContext,
    events: {} as MatchMachineEvent,
    input: {} as MatchMachineInput,
  },
  actors: {
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
      return {
        conclusion: deriveRetainedBranchConclusion(timeline),
        drawOfferResponse: null,
        hintFailure: null,
        hints: null,
        opponentFailure: null,
        timeline,
      }
    }),
    applyAcceptedDrawOffer: assign({
      conclusion: createDrawAgreementConclusion(),
      drawOfferResponse: null,
      hintFailure: null,
      hints: null,
      opponentFailure: null,
    }),
    applyResignation: assign(({ context }) => ({
      conclusion: createPlayerResignationConclusion(context.playerColor),
      drawOfferResponse: null,
      hintFailure: null,
      hints: null,
      opponentFailure: null,
    })),
    clearOpponentFailure: assign({ opponentFailure: null }),
    clearHintFailure: assign({ hintFailure: null }),
    markDrawOfferRejected: assign({ drawOfferResponse: "rejected" }),
    markMoveHintsUsed: assign({ moveHintsUsed: true }),
    prepareMoveHintsMutation: assign(({ context }) => ({
      pendingMutation: pendingMoveHintsMutation(context),
      persistenceFailure: null,
    })),
    prepareAutoHintModeMutation: assign(({ context, event }) => {
      if (event.type !== "MATCH.AUTO_HINT_MODE_CHANGED") {
        throw new Error("Hint-mode persistence received a non-setting event.")
      }
      return {
        pendingMutation: pendingAutoHintModeMutation(
          context,
          event.autoHintMode,
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
      const timeline = redoToNextPlayerDecision(
        context.timeline,
        context.playerColor,
      )
      if (timeline === undefined) {
        throw new Error("Guarded durable Redo became unavailable.")
      }
      return {
        pendingMutation: pendingPositionMutation(context, timeline),
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
      const timeline = undoToPreviousPlayerDecision(
        context.timeline,
        context.playerColor,
      )
      if (timeline === undefined) {
        throw new Error("Guarded durable Undo became unavailable.")
      }
      return {
        pendingMutation: pendingPositionMutation(context, timeline),
        persistenceFailure: null,
      }
    }),
    redoToPlayerDecision: assign(({ context }) => {
      const timeline = redoToNextPlayerDecision(
        context.timeline,
        context.playerColor,
      )

      return timeline === undefined
        ? {}
        : {
            hintFailure: null,
            hints: null,
            drawOfferResponse: null,
            opponentFailure: null,
            timeline,
          }
    }),
    undoToPlayerDecision: assign(({ context }) => {
      const timeline = undoToPreviousPlayerDecision(
        context.timeline,
        context.playerColor,
      )

      return timeline === undefined
        ? {}
        : {
            hintFailure: null,
            hints: null,
            drawOfferResponse: null,
            opponentFailure: null,
            timeline,
          }
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
      redoToNextPlayerDecision(context.timeline, context.playerColor) !==
        undefined,
    canRedoEphemerally: ({ context }) =>
      context.durability.type === "ephemeral" &&
      redoToNextPlayerDecision(context.timeline, context.playerColor) !==
        undefined,
    canUndoDurably: ({ context }) =>
      context.durability.type === "durable" &&
      undoToPreviousPlayerDecision(context.timeline, context.playerColor) !==
        undefined,
    canUndoEphemerally: ({ context }) =>
      context.durability.type === "ephemeral" &&
      undoToPreviousPlayerDecision(context.timeline, context.playerColor) !==
        undefined,
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
}).createMachine({
  id: "match",
  initial: "setup",
  context: ({ input }) => createInitialContext(input),
  on: {
    "MATCH.AUTO_HINT_MODE_CHANGED": [
      {
        actions: "prepareAutoHintModeMutation",
        guard: "autoHintModeChangeNeedsPersistence",
        target: "#match.persistingMutation",
      },
      {
        actions: "applyAutoHintMode",
        guard: "autoHintModeChangeNeedsNoPersistence",
        target: "#match.resolving",
      },
    ],
    "MATCH.DRAW_OFFER_REQUESTED": [
      {
        actions: "prepareAcceptedDrawOfferMutation",
        guard: "acceptedDrawNeedsPersistence",
        target: "#match.persistingMutation",
      },
      {
        actions: "applyAcceptedDrawOffer",
        guard: "acceptedDrawNeedsNoPersistence",
        target: "#match.complete",
      },
      {
        actions: "markDrawOfferRejected",
        guard: "canRejectDrawOffer",
      },
    ],
    "MATCH.RESIGN_REQUESTED": [
      {
        actions: "prepareResignationMutation",
        guard: "canResignDurably",
        target: "#match.persistingMutation",
      },
      {
        actions: "applyResignation",
        guard: "canResignEphemerally",
        target: "#match.complete",
      },
    ],
  },
  states: {
    setup: {
      always: "resolving",
    },
    resolving: {
      always: [
        { guard: "isComplete", target: "complete" },
        { guard: "isPlayerTurn", target: "playerTurn" },
        { target: "opponentThinking" },
      ],
    },
    playerTurn: {
      initial: "ready",
      states: {
        ready: {
          always: [
            {
              guard: "shouldShowAcceptedMoveHints",
              target: "moveHintsVisible",
            },
            {
              guard: "shouldShowAcceptedPieceHints",
              target: "pieceHintsVisible",
            },
            {
              guard: "shouldStartAutoHints",
              target: "analyzing",
            },
          ],
          on: {
            "MATCH.PIECE_HINTS_REQUESTED": {
              guard: "hasHintAnalyst",
              target: "analyzing",
            },
          },
        },
        analyzing: {
          invoke: {
            src: "requestHints",
            input: ({ context }) => ({
              analyst: requireHintAnalyst(context),
              request: createHintsRequest(context),
            }),
            onDone: [
              {
                guard: ({ context, event }) => {
                  const request = createHintsRequest(context)
                  return (
                    event.output.positionFen === request.position.fen &&
                    event.output.requestId === request.requestId &&
                    context.durability.type === "durable" &&
                    (!context.pieceHintsUsed ||
                      (context.autoHintMode === "auto-move-hints" &&
                        !context.moveHintsUsed))
                  )
                },
                actions: assign(({ context, event }) => ({
                  pendingMutation: pendingAcceptedHintsMutation(
                    context,
                    event.output,
                  ),
                  persistenceFailure: null,
                })),
                target: "#match.persistingMutation",
              },
              {
                actions: assign(({ context, event }) => ({
                  hintFailure: null,
                  hints: event.output,
                  moveHintsUsed:
                    context.moveHintsUsed ||
                    context.autoHintMode === "auto-move-hints",
                  pieceHintsUsed: true,
                })),
                guard: ({ context, event }) => {
                  const request = createHintsRequest(context)
                  return (
                    (context.durability.type === "ephemeral" ||
                      context.pieceHintsUsed) &&
                    event.output.positionFen === request.position.fen &&
                    event.output.requestId === request.requestId
                  )
                },
                target: "acceptedHintsVisible",
              },
              {
                actions: assign({ hintFailure: hintRequestFailure() }),
                target: "hintFailure",
              },
            ],
            onError: {
              actions: assign({ hintFailure: hintRequestFailure() }),
              target: "hintFailure",
            },
          },
        },
        acceptedHintsVisible: {
          always: [
            {
              guard: "autoMoveHintsAreEnabled",
              target: "moveHintsVisible",
            },
            { target: "pieceHintsVisible" },
          ],
        },
        pieceHintsVisible: {
          on: {
            "MATCH.MOVE_HINTS_REQUESTED": [
              {
                actions: "prepareMoveHintsMutation",
                guard: "moveHintsNeedPersistence",
                target: "#match.persistingMutation",
              },
              {
                actions: "markMoveHintsUsed",
                guard: "moveHintsNeedNoPersistence",
                target: "moveHintsVisible",
              },
            ],
          },
        },
        moveHintsVisible: {},
        hintFailure: {
          on: {
            "MATCH.PIECE_HINTS_REQUESTED": {
              actions: "clearHintFailure",
              guard: "hasHintAnalyst",
              target: "analyzing",
            },
          },
        },
      },
      on: {
        "MATCH.MOVE_REQUESTED": [
          {
            actions: "prepareRequestedMoveMutation",
            guard: "requestedDurableMoveIsLegal",
            target: "persistingMutation",
          },
          {
            actions: "applyRequestedMove",
            guard: "requestedEphemeralMoveIsLegal",
            target: "resolving",
          },
        ],
        "MATCH.REDO_REQUESTED": [
          {
            actions: "prepareRedoMutation",
            guard: "canRedoDurably",
            target: "persistingMutation",
          },
          {
            actions: "redoToPlayerDecision",
            guard: "canRedoEphemerally",
            target: "resolving",
          },
        ],
        "MATCH.UNDO_REQUESTED": [
          {
            actions: "prepareUndoMutation",
            guard: "canUndoDurably",
            target: "persistingMutation",
          },
          {
            actions: "undoToPlayerDecision",
            guard: "canUndoEphemerally",
            target: "resolving",
          },
        ],
      },
    },
    opponentThinking: {
      invoke: {
        src: "requestOpponentMove",
        input: ({ context }) => ({
          opponent: context.opponent,
          request: createOpponentRequest(context),
        }),
        onDone: [
          {
            actions: assign(({ context, event }) => ({
              pendingMutation: pendingPositionMutation(
                context,
                requireAppliedTimelineMove(context.timeline, event.output),
              ),
              persistenceFailure: null,
            })),
            guard: ({ context, event }) =>
              context.durability.type === "durable" &&
              moveIsLegal(context.timeline, event.output),
            target: "persistingMutation",
          },
          {
            actions: assign(({ context, event }) => {
              const timeline = requireAppliedTimelineMove(
                context.timeline,
                event.output,
              )
              return {
                conclusion: deriveRetainedBranchConclusion(timeline),
                drawOfferResponse: null,
                opponentFailure: null,
                timeline,
              }
            }),
            guard: ({ context, event }) =>
              context.durability.type === "ephemeral" &&
              moveIsLegal(context.timeline, event.output),
            target: "resolving",
          },
          {
            actions: assign({
              opponentFailure: illegalOpponentMoveFailure(),
            }),
            target: "opponentFailure",
          },
        ],
        onError: {
          actions: assign({ opponentFailure: opponentRequestFailure() }),
          target: "opponentFailure",
        },
      },
      on: {
        "MATCH.UNDO_REQUESTED": [
          {
            actions: "prepareUndoMutation",
            guard: "canUndoDurably",
            target: "persistingMutation",
          },
          {
            actions: "undoToPlayerDecision",
            guard: "canUndoEphemerally",
            target: "resolving",
          },
        ],
      },
    },
    persistingMutation: {
      invoke: {
        src: "persistMutation",
        input: ({ context }) => ({
          persistence: requireMatchPersistence(context),
          request: requirePendingMutation(context).request,
        }),
        onDone: [
          {
            actions: assign(({ context }) => acceptedPendingMutation(context)),
            guard: ({ context, event }) => {
              const pending = requirePendingMutation(context)
              return (
                pending.route === "complete" &&
                persistenceReceiptMatches(pending.request, event.output)
              )
            },
            target: "complete",
          },
          {
            actions: assign(({ context }) => acceptedPendingMutation(context)),
            guard: ({ context, event }) => {
              const pending = requirePendingMutation(context)
              return (
                pending.route === "resolve-position" &&
                persistenceReceiptMatches(pending.request, event.output)
              )
            },
            target: "resolving",
          },
          {
            actions: assign(({ context }) => acceptedPendingMutation(context)),
            guard: ({ context, event }) => {
              const pending = requirePendingMutation(context)
              return (
                pending.route === "accepted-hints-visible" &&
                persistenceReceiptMatches(pending.request, event.output)
              )
            },
            target: "#match.playerTurn.acceptedHintsVisible",
          },
          {
            actions: assign(({ context }) => acceptedPendingMutation(context)),
            guard: ({ context, event }) => {
              const pending = requirePendingMutation(context)
              return (
                pending.route === "move-hints-visible" &&
                persistenceReceiptMatches(pending.request, event.output)
              )
            },
            target: "#match.playerTurn.moveHintsVisible",
          },
          {
            actions: assign({
              persistenceFailure: stalePersistenceReceiptFailure(),
            }),
            target: "persistenceFailure",
          },
        ],
        onError: {
          actions: assign({
            persistenceFailure: persistenceRequestFailure(),
          }),
          target: "persistenceFailure",
        },
      },
    },
    persistenceFailure: {
      on: {
        "MATCH.PERSISTENCE_RETRY_REQUESTED": {
          target: "persistingMutation",
        },
      },
    },
    opponentFailure: {
      on: {
        "MATCH.OPPONENT_RETRY_REQUESTED": {
          actions: "clearOpponentFailure",
          target: "opponentThinking",
        },
        "MATCH.UNDO_REQUESTED": [
          {
            actions: "prepareUndoMutation",
            guard: "canUndoDurably",
            target: "persistingMutation",
          },
          {
            actions: "undoToPlayerDecision",
            guard: "canUndoEphemerally",
            target: "resolving",
          },
        ],
      },
    },
    complete: {
      on: {
        "MATCH.REDO_REQUESTED": [
          {
            actions: "prepareRedoMutation",
            guard: "canRedoDurably",
            target: "persistingMutation",
          },
          {
            actions: "redoToPlayerDecision",
            guard: "canRedoEphemerally",
            target: "complete",
          },
        ],
        "MATCH.UNDO_REQUESTED": [
          {
            actions: "prepareUndoMutation",
            guard: "canUndoDurably",
            target: "persistingMutation",
          },
          {
            actions: "undoToPlayerDecision",
            guard: "canUndoEphemerally",
            target: "complete",
          },
        ],
      },
    },
  },
})

export type MatchMachineSnapshot = SnapshotFrom<typeof matchMachineDefinition>

export {
  selectAreMatchMutationsFrozen,
  selectAutoHintMode,
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectDrawOfferResponse,
  selectHintFailure,
  selectHintStage,
  selectIsOpponentThinking,
  selectIsOpponentTurn,
  selectIsPersistingMutation,
  selectIsPlayerTurn,
  selectMatchHints,
  selectMatchConclusion,
  selectMatchPosition,
  selectMatchTimeline,
  selectMoveHintsUsed,
  selectOpponentFailure,
  selectPersistenceFailure,
  selectPieceHintsUsed,
} from "./matchSelectors.js"

export default matchMachineDefinition

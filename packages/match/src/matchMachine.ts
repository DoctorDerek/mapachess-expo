import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import type { BetterHintsResult } from "./betterHints.js"
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
  createHintsRequest,
  createInitialContext,
  createOpponentRequest,
  hintRequestFailure,
  illegalOpponentMoveFailure,
  moveIsLegal,
  opponentRequestFailure,
  pendingMoveHintsMutation,
  pendingPieceHintsMutation,
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

export const AUTO_HINTS_PIECE_DWELL_MS = 2_000

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
  delays: {
    autoHintsPieceDwell: AUTO_HINTS_PIECE_DWELL_MS,
  },
  actions: {
    applyRequestedMove: assign(({ context, event }) => {
      if (event.type !== "MATCH.MOVE_REQUESTED") {
        throw new Error("Move action received a non-move event.")
      }

      return {
        hintFailure: null,
        hints: null,
        opponentFailure: null,
        timeline: requireAppliedTimelineMove(context.timeline, event.moveId),
      }
    }),
    clearOpponentFailure: assign({ opponentFailure: null }),
    clearHintFailure: assign({ hintFailure: null }),
    markMoveHintsUsed: assign({ moveHintsUsed: true }),
    prepareMoveHintsMutation: assign(({ context }) => ({
      pendingMutation: pendingMoveHintsMutation(context),
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
            opponentFailure: null,
            timeline,
          }
    }),
  },
  guards: {
    autoMoveHintsNeedNoPersistence: ({ context }) =>
      context.autoHintsEnabled &&
      (context.durability.type === "ephemeral" || context.moveHintsUsed),
    autoMoveHintsNeedPersistence: ({ context }) =>
      context.autoHintsEnabled &&
      context.durability.type === "durable" &&
      !context.moveHintsUsed,
    isComplete: ({ context }) =>
      currentMatchPosition(context.timeline).status.type !== "playing",
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
      context.autoHintsEnabled && context.hintAnalyst !== null,
  },
}).createMachine({
  id: "match",
  initial: "setup",
  context: ({ input }) => createInitialContext(input),
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
          always: {
            guard: "shouldStartAutoHints",
            target: "analyzing",
          },
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
                    context.durability.type === "durable" &&
                    !context.pieceHintsUsed &&
                    event.output.positionFen === request.position.fen &&
                    event.output.requestId === request.requestId
                  )
                },
                actions: assign(({ context, event }) => ({
                  pendingMutation: pendingPieceHintsMutation(
                    context,
                    event.output,
                  ),
                  persistenceFailure: null,
                })),
                target: "#match.persistingMutation",
              },
              {
                actions: assign(({ event }) => ({
                  hintFailure: null,
                  hints: event.output,
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
                target: "pieceHintsVisible",
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
        pieceHintsVisible: {
          after: {
            autoHintsPieceDwell: [
              {
                actions: "prepareMoveHintsMutation",
                guard: "autoMoveHintsNeedPersistence",
                target: "#match.persistingMutation",
              },
              {
                actions: "markMoveHintsUsed",
                guard: "autoMoveHintsNeedNoPersistence",
                target: "moveHintsVisible",
              },
            ],
          },
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
            actions: assign(({ context, event }) => ({
              opponentFailure: null,
              timeline: requireAppliedTimelineMove(
                context.timeline,
                event.output,
              ),
            })),
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
                pending.route === "piece-hints-visible" &&
                persistenceReceiptMatches(pending.request, event.output)
              )
            },
            target: "#match.playerTurn.pieceHintsVisible",
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
  },
})

export type MatchMachineSnapshot = SnapshotFrom<typeof matchMachineDefinition>

export {
  selectAreMatchMutationsFrozen,
  selectCanRedo,
  selectCanUndo,
  selectHintFailure,
  selectHintStage,
  selectIsOpponentThinking,
  selectIsOpponentTurn,
  selectIsPersistingMutation,
  selectIsPlayerTurn,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectMoveHintsUsed,
  selectOpponentFailure,
  selectPersistenceFailure,
  selectPieceHintsUsed,
} from "./matchSelectors.js"

export default matchMachineDefinition

import { assign, type SnapshotFrom } from "xstate"
import captureError from "@mapachess/diagnostics/error-diagnostic"
import { clockHasExpired } from "./matchClock.js"
import { pendingClockPause } from "./matchClockWorkflow.js"
import matchMachineSetup from "./matchMachineSetup.js"
import { persistenceReceiptMatches } from "./matchPersistence.js"
import {
  acceptedPendingMutation,
  createHintsRequest,
  createInitialContext,
  createOpponentRequest,
  hintRequestFailure,
  illegalOpponentMoveFailure,
  moveIsLegal,
  opponentRequestFailure,
  pendingAcceptedHintsMutation,
  pendingAutoHintModeMutation,
  pendingPositionMutation,
  persistenceRequestFailure,
  requireAppliedTimelineMove,
  requireHintAnalyst,
  requireMatchPersistence,
  requirePendingMutation,
  stalePersistenceReceiptFailure,
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

const matchMachineDefinition = matchMachineSetup.createMachine({
  id: "match",
  initial: "setup",
  context: ({ input }) => createInitialContext(input),
  on: {
    "MATCH.CLOCK_EXPIRED": [
      {
        guard: ({ context }) =>
          context.pendingMutation === null &&
          context.conclusion === null &&
          clockHasExpired(context.clock, context.monotonicClock.now()) &&
          context.durability.type === "durable",
        actions: "prepareClockTimeout",
        target: ".persistingMutation",
      },
      {
        guard: ({ context }) =>
          context.pendingMutation === null &&
          context.conclusion === null &&
          clockHasExpired(context.clock, context.monotonicClock.now()),
        actions: "applyClockTimeout",
        target: ".complete",
      },
    ],
    "MATCH.CLOCK_PAUSE_REQUESTED": [
      {
        guard: ({ context }) =>
          context.pendingMutation === null &&
          context.conclusion === null &&
          context.durability.type === "ephemeral" &&
          clockHasExpired(context.clock, context.monotonicClock.now()),
        actions: "applyClockTimeout",
        target: ".complete",
      },
      {
        guard: ({ context }) =>
          context.clock !== null &&
          !context.clock.paused &&
          context.conclusion === null &&
          context.pendingMutation !== null,
        actions: "pauseClock",
      },
      {
        guard: ({ context }) =>
          context.clock !== null &&
          !context.clock.paused &&
          context.conclusion === null &&
          context.durability.type === "durable",
        actions: "prepareClockPause",
        target: ".persistingMutation",
      },
      {
        guard: ({ context }) =>
          context.clock !== null &&
          !context.clock.paused &&
          context.conclusion === null,
        actions: "pauseClock",
        target: ".paused",
      },
    ],
    "MATCH.AUTO_HINT_MODE_CHANGED": [
      {
        guard: ({ context }) => context.pendingMutation !== null,
        actions: assign(({ event }) => ({
          requestedAutoHintMode: event.autoHintMode,
        })),
      },
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
        {
          guard: ({ context }) => context.clock?.paused === true,
          target: "paused",
        },
        { guard: "isPlayerTurn", target: "playerTurn" },
        { target: "opponentThinking" },
      ],
    },
    playerTurn: {
      entry: "startClock",
      exit: "stopClock",
      invoke: {
        src: "clockDeadline",
        input: ({ context }) => ({
          clock: context.clock,
          monotonicClock: context.monotonicClock,
        }),
      },
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
              actions: assign(({ event }) => ({
                hintFailure: hintRequestFailure(captureError(event.error)),
              })),
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
      entry: "startClock",
      exit: "stopClock",
      invoke: [
        {
          src: "clockDeadline",
          input: ({ context }) => ({
            clock: context.clock,
            monotonicClock: context.monotonicClock,
          }),
        },
        {
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
                return acceptedPendingMutation({
                  ...context,
                  pendingMutation: pendingPositionMutation(context, timeline),
                })
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
            actions: assign(({ event }) => ({
              opponentFailure: opponentRequestFailure(event.error),
            })),
            target: "opponentFailure",
          },
        },
      ],
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
            guard: ({ context, event }) =>
              context.requestedAutoHintMode !== null &&
              context.requestedAutoHintMode !==
                requirePendingMutation(context).request.autoHintMode &&
              persistenceReceiptMatches(
                requirePendingMutation(context).request,
                event.output,
              ),
            actions: assign(({ context }) => {
              const requested = context.requestedAutoHintMode
              if (requested === null)
                throw new Error("A queued hint preference is required.")
              const accepted = acceptedPendingMutation(context)
              return {
                ...accepted,
                pendingMutation: pendingAutoHintModeMutation(
                  { ...context, ...accepted },
                  requested,
                  requirePendingMutation(context).retainedHintStage,
                ),
              }
            }),
            target: "persistingMutation",
            reenter: true,
          },
          {
            guard: ({ context, event }) =>
              context.clock?.paused === true &&
              requirePendingMutation(context).clock?.paused === false &&
              requirePendingMutation(context).conclusion === null &&
              persistenceReceiptMatches(
                requirePendingMutation(context).request,
                event.output,
              ),
            actions: assign(({ context }) => {
              const accepted = acceptedPendingMutation(context)
              return {
                ...accepted,
                pendingMutation: pendingClockPause({
                  ...context,
                  ...accepted,
                }),
              }
            }),
            target: "persistingMutation",
            reenter: true,
          },
          {
            actions: assign(({ context }) => acceptedPendingMutation(context)),
            guard: ({ context, event }) =>
              context.clock?.paused === true &&
              requirePendingMutation(context).conclusion === null &&
              persistenceReceiptMatches(
                requirePendingMutation(context).request,
                event.output,
              ),
            target: "paused",
          },
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
          actions: assign(({ event }) => ({
            persistenceFailure: persistenceRequestFailure(event.error),
          })),
          target: "persistenceFailure",
        },
      },
    },
    persistenceFailure: {
      entry: "pauseClock",
      on: {
        "MATCH.PERSISTENCE_RETRY_REQUESTED": {
          target: "persistingMutation",
        },
      },
    },
    opponentFailure: {
      entry: "pauseClock",
      always: [
        {
          guard: ({ context }) =>
            context.durability.type === "durable" &&
            clockHasExpired(context.clock, context.monotonicClock.now()),
          actions: "prepareClockTimeout",
          target: "persistingMutation",
        },
        {
          guard: ({ context }) =>
            clockHasExpired(context.clock, context.monotonicClock.now()),
          actions: "applyClockTimeout",
          target: "complete",
        },
      ],
      on: {
        "MATCH.OPPONENT_RETRY_REQUESTED": {
          actions: "clearOpponentFailure",
          target: "resolving",
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
      entry: "stopClock",
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
    paused: {
      on: {
        "MATCH.CLOCK_RESUME_REQUESTED": {
          actions: "resumeClock",
          target: "resolving",
        },
        "MATCH.UNDO_REQUESTED": [
          {
            guard: "canUndoDurably",
            actions: "prepareUndoMutation",
            target: "persistingMutation",
          },
          {
            guard: "canUndoEphemerally",
            actions: "undoToPlayerDecision",
            target: "resolving",
          },
        ],
        "MATCH.REDO_REQUESTED": [
          {
            guard: "canRedoDurably",
            actions: "prepareRedoMutation",
            target: "persistingMutation",
          },
          {
            guard: "canRedoEphemerally",
            actions: "redoToPlayerDecision",
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
  selectAutoHintMode,
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectDrawOfferResponse,
  selectHasRedoHistory,
  selectHasUndoHistory,
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

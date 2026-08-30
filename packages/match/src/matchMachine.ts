import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import type {
  BetterHintsAnalyst,
  BetterHintsRequest,
  BetterHintsResult,
} from "./betterHints.js"
import {
  applyMatchMove,
  listLegalMatchMoves,
  type AppliedMatchMove,
  type LegalMatchMove,
  type MatchMoveId,
} from "./matchMove.js"
import type { MatchColor, MatchPosition } from "./matchPosition.js"
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
  | Readonly<{ type: "MATCH.UNDO_REQUESTED" }>
  | Readonly<{ type: "MATCH.REDO_REQUESTED" }>

export type MatchMachineInput = Readonly<{
  autoHintsEnabled: boolean
  hintAnalyst?: BetterHintsAnalyst
  initialPosition: MatchPosition
  matchId: string
  opponent: MatchOpponent
  playerColor: MatchColor
}>

export type MatchMachineContext = Readonly<{
  autoHintsEnabled: boolean
  hintAnalyst: BetterHintsAnalyst | null
  hintFailure: MatchHintFailure | null
  hints: BetterHintsResult | null
  matchId: string
  moveHintsUsed: boolean
  opponent: MatchOpponent
  opponentFailure: MatchOpponentFailure | null
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

type MatchOpponentActorInput = Readonly<{
  opponent: MatchOpponent
  request: MatchOpponentRequest
}>

type MatchHintsActorInput = Readonly<{
  analyst: BetterHintsAnalyst
  request: BetterHintsRequest
}>

export const AUTO_HINTS_PIECE_DWELL_MS = 2_000

const createInitialContext = (
  input: MatchMachineInput,
): MatchMachineContext => {
  if (input.matchId.length === 0 || input.matchId !== input.matchId.trim()) {
    throw new TypeError("matchId must be nonempty and trimmed.")
  }

  return {
    autoHintsEnabled: input.autoHintsEnabled,
    hintAnalyst: input.hintAnalyst ?? null,
    hintFailure: null,
    hints: null,
    matchId: input.matchId,
    moveHintsUsed: false,
    opponent: input.opponent,
    opponentFailure: null,
    pieceHintsUsed: false,
    playerColor: input.playerColor,
    timeline: createMatchTimeline(input.initialPosition),
  }
}

const acceptedMoves = (timeline: MatchTimeline): readonly AppliedMatchMove[] =>
  Object.freeze(
    timeline.transitions
      .slice(0, timeline.cursor)
      .map((transition) => transition.move),
  )

const createOpponentRequest = (
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

const createHintsRequest = (
  context: MatchMachineContext,
): BetterHintsRequest => {
  const position = currentMatchPosition(context.timeline)
  return Object.freeze({
    playerColor: context.playerColor,
    position,
    requestId: `${context.matchId}/hints/ply/${String(context.timeline.cursor + 1)}/fen/${position.fen}`,
  })
}

const requireHintAnalyst = (
  context: MatchMachineContext,
): BetterHintsAnalyst => {
  if (context.hintAnalyst === null) {
    throw new Error("Hint analysis began without an injected analyst.")
  }
  return context.hintAnalyst
}

const moveIsLegal = (timeline: MatchTimeline, moveId: MatchMoveId): boolean =>
  applyMatchMove(currentMatchPosition(timeline), moveId).ok

const requireAppliedTimelineMove = (
  timeline: MatchTimeline,
  moveId: MatchMoveId,
): MatchTimeline => {
  const result = applyMatchTimelineMove(timeline, moveId)
  if (!result.ok) {
    throw new Error("A guarded canonical match move became illegal.")
  }

  return result.timeline
}

const undoToPreviousPlayerDecision = (
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

const redoToNextPlayerDecision = (
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

const illegalOpponentMoveFailure = (): MatchOpponentFailure =>
  Object.freeze({ type: "MATCH.OPPONENT_MOVE_ILLEGAL" })

const opponentRequestFailure = (): MatchOpponentFailure =>
  Object.freeze({ type: "MATCH.OPPONENT_REQUEST_FAILED" })

const hintRequestFailure = (): MatchHintFailure =>
  Object.freeze({ type: "MATCH.HINT_REQUEST_FAILED" })

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
        opponentFailure: null,
        timeline: requireAppliedTimelineMove(context.timeline, event.moveId),
      }
    }),
    clearOpponentFailure: assign({ opponentFailure: null }),
    clearCurrentHints: assign({ hintFailure: null, hints: null }),
    clearHintFailure: assign({ hintFailure: null }),
    markMoveHintsUsed: assign({ moveHintsUsed: true }),
    redoToPlayerDecision: assign(({ context }) => {
      const timeline = redoToNextPlayerDecision(
        context.timeline,
        context.playerColor,
      )

      return timeline === undefined ? {} : { opponentFailure: null, timeline }
    }),
    undoToPlayerDecision: assign(({ context }) => {
      const timeline = undoToPreviousPlayerDecision(
        context.timeline,
        context.playerColor,
      )

      return timeline === undefined ? {} : { opponentFailure: null, timeline }
    }),
  },
  guards: {
    areAutoHintsEnabled: ({ context }) => context.autoHintsEnabled,
    canRedoToPlayerDecision: ({ context }) =>
      redoToNextPlayerDecision(context.timeline, context.playerColor) !==
      undefined,
    canUndoToPlayerDecision: ({ context }) =>
      undoToPreviousPlayerDecision(context.timeline, context.playerColor) !==
      undefined,
    isComplete: ({ context }) =>
      currentMatchPosition(context.timeline).status.type !== "playing",
    isPlayerTurn: ({ context }) =>
      currentMatchPosition(context.timeline).turn === context.playerColor,
    hasHintAnalyst: ({ context }) => context.hintAnalyst !== null,
    requestedMoveIsLegal: ({ context, event }) =>
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
      exit: "clearCurrentHints",
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
                actions: assign(({ event }) => ({
                  hintFailure: null,
                  hints: event.output,
                  pieceHintsUsed: true,
                })),
                guard: ({ context, event }) => {
                  const request = createHintsRequest(context)
                  return (
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
            autoHintsPieceDwell: {
              actions: "markMoveHintsUsed",
              guard: "areAutoHintsEnabled",
              target: "moveHintsVisible",
            },
          },
          on: {
            "MATCH.MOVE_HINTS_REQUESTED": {
              actions: "markMoveHintsUsed",
              target: "moveHintsVisible",
            },
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
        "MATCH.MOVE_REQUESTED": {
          actions: "applyRequestedMove",
          guard: "requestedMoveIsLegal",
          target: "resolving",
        },
        "MATCH.REDO_REQUESTED": {
          actions: "redoToPlayerDecision",
          guard: "canRedoToPlayerDecision",
          target: "resolving",
        },
        "MATCH.UNDO_REQUESTED": {
          actions: "undoToPlayerDecision",
          guard: "canUndoToPlayerDecision",
          target: "resolving",
        },
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
              opponentFailure: null,
              timeline: requireAppliedTimelineMove(
                context.timeline,
                event.output,
              ),
            })),
            guard: ({ context, event }) =>
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
        "MATCH.UNDO_REQUESTED": {
          actions: "undoToPlayerDecision",
          guard: "canUndoToPlayerDecision",
          target: "resolving",
        },
      },
    },
    opponentFailure: {
      on: {
        "MATCH.OPPONENT_RETRY_REQUESTED": {
          actions: "clearOpponentFailure",
          target: "opponentThinking",
        },
        "MATCH.UNDO_REQUESTED": {
          actions: "undoToPlayerDecision",
          guard: "canUndoToPlayerDecision",
          target: "resolving",
        },
      },
    },
    complete: {
      on: {
        "MATCH.UNDO_REQUESTED": {
          actions: "undoToPlayerDecision",
          guard: "canUndoToPlayerDecision",
          target: "resolving",
        },
      },
    },
  },
})

export type MatchMachineSnapshot = SnapshotFrom<typeof matchMachineDefinition>

export const selectMatchPosition = (
  snapshot: MatchMachineSnapshot,
): MatchPosition => currentMatchPosition(snapshot.context.timeline)

export const selectMatchTimeline = (
  snapshot: MatchMachineSnapshot,
): MatchTimeline => snapshot.context.timeline

export const selectCanUndo = (snapshot: MatchMachineSnapshot): boolean =>
  undoToPreviousPlayerDecision(
    snapshot.context.timeline,
    snapshot.context.playerColor,
  ) !== undefined

export const selectCanRedo = (snapshot: MatchMachineSnapshot): boolean =>
  redoToNextPlayerDecision(
    snapshot.context.timeline,
    snapshot.context.playerColor,
  ) !== undefined

export const selectIsPlayerTurn = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.matches("playerTurn")

export const selectIsOpponentTurn = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.matches("opponentThinking") || snapshot.matches("opponentFailure")

export const selectIsOpponentThinking = (
  snapshot: MatchMachineSnapshot,
): boolean => snapshot.matches("opponentThinking")

export const selectHintStage = (
  snapshot: MatchMachineSnapshot,
): MatchHintStage => {
  if (!snapshot.matches("playerTurn")) return "hidden"
  if (snapshot.context.hintAnalyst === null) return "unavailable"
  if (snapshot.matches({ playerTurn: "analyzing" })) return "loading"
  if (snapshot.matches({ playerTurn: "pieceHintsVisible" })) {
    return "piece-hints"
  }
  if (snapshot.matches({ playerTurn: "moveHintsVisible" })) {
    return "move-hints"
  }
  if (snapshot.matches({ playerTurn: "hintFailure" })) return "failure"
  return "ready"
}

export const selectMatchHints = (
  snapshot: MatchMachineSnapshot,
): BetterHintsResult | null => snapshot.context.hints

export const selectHintFailure = (
  snapshot: MatchMachineSnapshot,
): MatchHintFailure | null => snapshot.context.hintFailure

export const selectMoveHintsUsed = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.context.moveHintsUsed

export const selectPieceHintsUsed = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.context.pieceHintsUsed

export const selectOpponentFailure = (
  snapshot: MatchMachineSnapshot,
): MatchOpponentFailure | null => snapshot.context.opponentFailure

export default matchMachineDefinition

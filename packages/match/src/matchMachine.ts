import { assign, setup, type SnapshotFrom } from "xstate"
import type { MatchMoveId } from "./matchMove.js"
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

export type MatchMoveRequester = "player" | "opponent"

export type MatchMachineEvent =
  | Readonly<{
      moveId: MatchMoveId
      requestedBy: MatchMoveRequester
      type: "MATCH.MOVE_REQUESTED"
    }>
  | Readonly<{ type: "MATCH.UNDO_REQUESTED" }>
  | Readonly<{ type: "MATCH.REDO_REQUESTED" }>

export type MatchMachineInput = Readonly<{
  initialPosition: MatchPosition
  playerColor: MatchColor
}>

export type MatchMachineContext = Readonly<{
  playerColor: MatchColor
  timeline: MatchTimeline
}>

const oppositeColor = (color: MatchColor): MatchColor =>
  color === "white" ? "black" : "white"

const requestedColor = (
  playerColor: MatchColor,
  requestedBy: MatchMoveRequester,
): MatchColor =>
  requestedBy === "player" ? playerColor : oppositeColor(playerColor)

const matchMachineDefinition = setup({
  types: {
    context: {} as MatchMachineContext,
    events: {} as MatchMachineEvent,
    input: {} as MatchMachineInput,
  },
  actions: {
    applyRequestedMove: assign(({ context, event }) => {
      if (event.type !== "MATCH.MOVE_REQUESTED") {
        throw new Error("Move action received a non-move event")
      }
      const result = applyMatchTimelineMove(context.timeline, event.moveId)
      return result.ok ? { timeline: result.timeline } : {}
    }),
    redoTimeline: assign(({ context }) => {
      const result = redoMatchTimeline(context.timeline)
      return result.ok ? { timeline: result.timeline } : {}
    }),
    undoTimeline: assign(({ context }) => {
      const result = undoMatchTimeline(context.timeline)
      return result.ok ? { timeline: result.timeline } : {}
    }),
  },
  guards: {
    canRedo: ({ context }) => canRedoMatchTimeline(context.timeline),
    canUndo: ({ context }) => canUndoMatchTimeline(context.timeline),
    isComplete: ({ context }) =>
      currentMatchPosition(context.timeline).status.type !== "playing",
    requesterOwnsTurn: ({ context, event }) =>
      event.type === "MATCH.MOVE_REQUESTED" &&
      currentMatchPosition(context.timeline).turn ===
        requestedColor(context.playerColor, event.requestedBy),
  },
}).createMachine({
  id: "match",
  initial: "setup",
  context: ({ input }) => ({
    playerColor: input.playerColor,
    timeline: createMatchTimeline(input.initialPosition),
  }),
  states: {
    setup: {
      always: "resolving",
    },
    resolving: {
      always: [
        { guard: "isComplete", target: "complete" },
        { target: "playing" },
      ],
    },
    playing: {
      on: {
        "MATCH.MOVE_REQUESTED": {
          actions: "applyRequestedMove",
          guard: "requesterOwnsTurn",
          target: "resolving",
        },
        "MATCH.REDO_REQUESTED": {
          actions: "redoTimeline",
          guard: "canRedo",
          target: "resolving",
        },
        "MATCH.UNDO_REQUESTED": {
          actions: "undoTimeline",
          guard: "canUndo",
          target: "resolving",
        },
      },
    },
    complete: {
      on: {
        "MATCH.REDO_REQUESTED": {
          actions: "redoTimeline",
          guard: "canRedo",
          target: "resolving",
        },
        "MATCH.UNDO_REQUESTED": {
          actions: "undoTimeline",
          guard: "canUndo",
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
  canUndoMatchTimeline(snapshot.context.timeline)

export const selectCanRedo = (snapshot: MatchMachineSnapshot): boolean =>
  canRedoMatchTimeline(snapshot.context.timeline)

export const selectIsPlayerTurn = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.matches("playing") &&
  selectMatchPosition(snapshot).turn === snapshot.context.playerColor

export const selectIsOpponentTurn = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.matches("playing") &&
  selectMatchPosition(snapshot).turn !== snapshot.context.playerColor

export default matchMachineDefinition

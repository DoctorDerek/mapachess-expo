import { assign, setup, type SnapshotFrom } from "xstate"
import type { MatchColor } from "@mapachess/match/match-position"
import type { MoveClassification } from "./moveClassification.js"

export const MOVE_REACTION_DURATION_MS = 5_000

export type MoveReaction = Readonly<{
  id: string
  mover: MatchColor
  san: string
  classification: MoveClassification
}>

type MoveReactionContext = Readonly<{
  visible: MoveReaction | null
  pending: readonly MoveReaction[]
  receivedIds: readonly string[]
}>

export type MoveReactionEvent =
  | Readonly<{ type: "MOVE_REACTION.RECEIVED"; reaction: MoveReaction }>
  | Readonly<{ type: "MOVE_REACTION.DISMISSED"; id: string }>
  | Readonly<{ type: "MOVE_REACTION.PRESENTED"; id: string }>
  | Readonly<{ type: "MOVE_REACTION.CLEARED" }>

const moveReactionMachine = setup({
  types: {
    context: {} as MoveReactionContext,
    events: {} as MoveReactionEvent,
  },
  delays: { visibilityDuration: MOVE_REACTION_DURATION_MS },
  guards: {
    hasPending: ({ context }) => context.pending.length > 0,
    isNewReaction: ({ context, event }) =>
      event.type === "MOVE_REACTION.RECEIVED" &&
      !context.receivedIds.includes(event.reaction.id),
    dismissesVisible: ({ context, event }) =>
      event.type === "MOVE_REACTION.DISMISSED" &&
      event.id === context.visible?.id,
    presentsVisible: ({ context, event }) =>
      event.type === "MOVE_REACTION.PRESENTED" &&
      event.id === context.visible?.id,
  },
  actions: {
    show: assign(({ context, event }) => {
      if (event.type !== "MOVE_REACTION.RECEIVED")
        throw new Error("Showing a reaction requires a received move.")
      return {
        visible: event.reaction,
        receivedIds: [...context.receivedIds, event.reaction.id],
      }
    }),
    queue: assign(({ context, event }) => {
      if (event.type !== "MOVE_REACTION.RECEIVED")
        throw new Error("Queuing a reaction requires a received move.")
      return {
        pending: [...context.pending, event.reaction],
        receivedIds: [...context.receivedIds, event.reaction.id],
      }
    }),
    advance: assign(({ context }) => ({
      visible: context.pending[0] ?? null,
      pending: context.pending.slice(1),
    })),
    hide: assign({ visible: null }),
    clear: assign({ visible: null, pending: [], receivedIds: [] }),
  },
}).createMachine({
  id: "moveReaction",
  initial: "idle",
  context: { visible: null, pending: [], receivedIds: [] },
  on: {
    "MOVE_REACTION.CLEARED": { actions: "clear", target: ".idle" },
  },
  states: {
    idle: {
      on: {
        "MOVE_REACTION.RECEIVED": {
          guard: "isNewReaction",
          actions: "show",
          target: "active",
        },
      },
    },
    active: {
      initial: "awaitingPresentation",
      states: {
        awaitingPresentation: {
          on: {
            "MOVE_REACTION.PRESENTED": {
              guard: "presentsVisible",
              target: "displaying",
            },
          },
        },
        displaying: {
          after: { visibilityDuration: "#moveReaction.advancing" },
        },
      },
      on: {
        "MOVE_REACTION.RECEIVED": { guard: "isNewReaction", actions: "queue" },
        "MOVE_REACTION.DISMISSED": {
          guard: "dismissesVisible",
          target: "advancing",
        },
      },
    },
    advancing: {
      always: [
        { guard: "hasPending", actions: "advance", target: "active" },
        { actions: "hide", target: "idle" },
      ],
    },
  },
})

export default moveReactionMachine

export type MoveReactionWaitingCounts = Readonly<{
  white: number
  black: number
}>

export const selectMoveReactionWaitingCounts = (
  snapshot: SnapshotFrom<typeof moveReactionMachine>,
): MoveReactionWaitingCounts =>
  snapshot.context.pending.reduce<MoveReactionWaitingCounts>(
    (counts, reaction) => ({
      white: counts.white + (reaction.mover === "white" ? 1 : 0),
      black: counts.black + (reaction.mover === "black" ? 1 : 0),
    }),
    { white: 0, black: 0 },
  )

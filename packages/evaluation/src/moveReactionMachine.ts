import { assign, setup } from "xstate"
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
  pending: MoveReaction | null
}>

export type MoveReactionEvent =
  | Readonly<{ type: "MOVE_REACTION.RECEIVED"; reaction: MoveReaction }>
  | Readonly<{ type: "MOVE_REACTION.DISMISSED"; id: string }>
  | Readonly<{ type: "MOVE_REACTION.CLEARED" }>

const priority = ({ classification }: MoveReaction): number =>
  classification.grade === "best" || classification.grade === "good" ? 0 : 1

const moveReactionMachine = setup({
  types: {
    context: {} as MoveReactionContext,
    events: {} as MoveReactionEvent,
  },
  delays: { visibilityDuration: MOVE_REACTION_DURATION_MS },
  guards: {
    hasPending: ({ context }) => context.pending !== null,
    dismissesVisible: ({ context, event }) =>
      event.type === "MOVE_REACTION.DISMISSED" &&
      event.id === context.visible?.id,
  },
  actions: {
    show: assign(({ event }) => {
      if (event.type !== "MOVE_REACTION.RECEIVED")
        throw new Error("Showing a reaction requires a received move.")
      return { visible: event.reaction, pending: null }
    }),
    queue: assign(({ context, event }) => {
      if (event.type !== "MOVE_REACTION.RECEIVED")
        throw new Error("Queuing a reaction requires a received move.")
      if (
        event.reaction.id === context.visible?.id ||
        event.reaction.id === context.pending?.id
      )
        return {}
      return {
        pending:
          context.pending === null ||
          priority(event.reaction) >= priority(context.pending)
            ? event.reaction
            : context.pending,
      }
    }),
    advance: assign(({ context }) => ({
      visible: context.pending,
      pending: null,
    })),
    clear: assign({ visible: null, pending: null }),
  },
}).createMachine({
  id: "moveReaction",
  initial: "idle",
  context: { visible: null, pending: null },
  on: {
    "MOVE_REACTION.CLEARED": { actions: "clear", target: ".idle" },
  },
  states: {
    idle: {
      on: {
        "MOVE_REACTION.RECEIVED": { actions: "show", target: "visible" },
      },
    },
    visible: {
      after: { visibilityDuration: "advancing" },
      on: {
        "MOVE_REACTION.RECEIVED": { actions: "queue" },
        "MOVE_REACTION.DISMISSED": {
          guard: "dismissesVisible",
          target: "advancing",
        },
      },
    },
    advancing: {
      always: [
        { guard: "hasPending", actions: "advance", target: "visible" },
        { actions: "clear", target: "idle" },
      ],
    },
  },
})

export default moveReactionMachine

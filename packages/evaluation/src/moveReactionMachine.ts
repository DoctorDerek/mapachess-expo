import {
  assign,
  enqueueActions,
  setup,
  type ActorRefFrom,
  type SnapshotFrom,
} from "xstate"
import type { MatchColor } from "@mapachess/match/match-position"
import type { MoveClassification } from "./moveClassification.js"
import moveReactionCardMachine from "./moveReactionCardMachine.js"

export { MOVE_REACTION_DURATION_MS } from "./moveReactionCardMachine.js"

export type MoveReaction = Readonly<{
  id: string
  ply: number
  notation: string
  mover: MatchColor
  classification: MoveClassification
}>

export type MoveReactionCard = Readonly<{
  presentationId: string
  reaction: MoveReaction
  actor: ActorRefFrom<typeof moveReactionCardMachine>
}>

type MoveReactionContext = Readonly<{
  cards: readonly MoveReactionCard[]
  receivedIds: readonly string[]
  generation: number
}>

export type MoveReactionEvent =
  | Readonly<{ type: "MOVE_REACTION.RECEIVED"; reaction: MoveReaction }>
  | Readonly<{
      type: "MOVE_REACTION.DISMISSED" | "MOVE_REACTION.EXPIRED"
      presentationId: string
    }>
  | Readonly<{ type: "MOVE_REACTION.CLEARED" }>

const moveReactionMachine = setup({
  types: {
    context: {} as MoveReactionContext,
    events: {} as MoveReactionEvent,
  },
  actors: { card: moveReactionCardMachine },
  guards: {
    isNewReaction: ({ context, event }) =>
      event.type === "MOVE_REACTION.RECEIVED" &&
      !context.receivedIds.includes(event.reaction.id),
  },
  actions: {
    receive: assign(({ context, event, spawn }) => {
      if (event.type !== "MOVE_REACTION.RECEIVED")
        throw new Error("Receiving a card requires a completed move reaction.")
      const presentationId = `${String(context.generation)}/${event.reaction.id}`
      const card: MoveReactionCard = {
        presentationId,
        reaction: event.reaction,
        actor: spawn("card", {
          id: presentationId,
          input: { presentationId },
        }),
      }
      return {
        cards: [...context.cards, card].sort(
          (left, right) => right.reaction.ply - left.reaction.ply,
        ),
        receivedIds: [...context.receivedIds, event.reaction.id],
      }
    }),
    remove: enqueueActions(({ context, event, enqueue }) => {
      if (
        event.type !== "MOVE_REACTION.DISMISSED" &&
        event.type !== "MOVE_REACTION.EXPIRED"
      )
        throw new Error("Removing a card requires its dismissal or expiry.")
      const card = context.cards.find(
        (current) => current.presentationId === event.presentationId,
      )
      if (card === undefined) return
      enqueue.stopChild(card.actor)
      enqueue.assign({
        cards: context.cards.filter((current) => current !== card),
      })
    }),
    clear: enqueueActions(({ context, enqueue }) => {
      for (const card of context.cards) enqueue.stopChild(card.actor)
      enqueue.assign({
        cards: [],
        receivedIds: [],
        generation: context.generation + 1,
      })
    }),
  },
}).createMachine({
  id: "moveReaction",
  context: { cards: [], receivedIds: [], generation: 0 },
  on: {
    "MOVE_REACTION.RECEIVED": { guard: "isNewReaction", actions: "receive" },
    "MOVE_REACTION.DISMISSED": { actions: "remove" },
    "MOVE_REACTION.EXPIRED": { actions: "remove" },
    "MOVE_REACTION.CLEARED": { actions: "clear" },
  },
})

export default moveReactionMachine

export const selectMoveReactionColumns = (
  snapshot: SnapshotFrom<typeof moveReactionMachine>,
  playerColor: MatchColor,
): Readonly<{
  hero: readonly MoveReactionCard[]
  opponent: readonly MoveReactionCard[]
}> => ({
  hero: snapshot.context.cards.filter(
    (card) => card.reaction.mover === playerColor,
  ),
  opponent: snapshot.context.cards.filter(
    (card) => card.reaction.mover !== playerColor,
  ),
})

import { sendParent, setup } from "xstate"

export const MOVE_REACTION_DURATION_MS = 5_000

type MoveReactionCardIdentity = Readonly<{ presentationId: string }>

const moveReactionCardMachine = setup({
  types: {
    context: {} as MoveReactionCardIdentity,
    input: {} as MoveReactionCardIdentity,
    events: {} as Readonly<{ type: "MOVE_REACTION.PRESENTED" }>,
  },
  delays: { visibilityDuration: MOVE_REACTION_DURATION_MS },
}).createMachine({
  id: "moveReactionCard",
  context: ({ input }) => input,
  initial: "awaitingPresentation",
  states: {
    awaitingPresentation: {
      on: { "MOVE_REACTION.PRESENTED": "displaying" },
    },
    displaying: {
      after: { visibilityDuration: "expired" },
    },
    expired: {
      type: "final",
      entry: sendParent(({ context }) => ({
        type: "MOVE_REACTION.EXPIRED",
        presentationId: context.presentationId,
      })),
    },
  },
})

export default moveReactionCardMachine

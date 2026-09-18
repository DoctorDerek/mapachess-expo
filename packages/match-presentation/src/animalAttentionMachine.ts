import { assign, setup } from "xstate"

type AttentionEvent =
  | Readonly<{
      type: "ANIMAL_ATTENTION.INPUT_CHANGED"
      active: boolean
      attention: boolean
    }>
  | Readonly<{ type: "ANIMAL_ATTENTION.COMPLETED"; ordinal: number }>

const animalAttentionMachine = setup({
  types: {
    context: {} as {
      attentionRequested: boolean
      ordinal: number
      active: boolean
      calmOrdinal: number
    },
    events: {} as AttentionEvent,
  },
  actions: {
    recordInput: assign({
      active: ({ context, event }) =>
        event.type === "ANIMAL_ATTENTION.INPUT_CHANGED"
          ? event.active
          : context.active,
      calmOrdinal: ({ context, event }) =>
        event.type === "ANIMAL_ATTENTION.INPUT_CHANGED" &&
        event.active &&
        !context.active
          ? context.calmOrdinal + 1
          : context.calmOrdinal,
      attentionRequested: ({ context, event }) =>
        event.type === "ANIMAL_ATTENTION.INPUT_CHANGED"
          ? event.attention
          : context.attentionRequested,
    }),
    advanceChoice: assign({ ordinal: ({ context }) => context.ordinal + 1 }),
  },
  guards: {
    isNewEntry: ({ context, event }) =>
      event.type === "ANIMAL_ATTENTION.INPUT_CHANGED" &&
      event.active &&
      event.attention &&
      !context.attentionRequested,
    isUnavailable: ({ event }) =>
      event.type === "ANIMAL_ATTENTION.INPUT_CHANGED" &&
      (!event.active || !event.attention),
    isCurrentCompletion: ({ context, event }) =>
      event.type === "ANIMAL_ATTENTION.COMPLETED" &&
      event.ordinal === context.ordinal,
  },
}).createMachine({
  id: "animalAttention",
  initial: "resting",
  context: {
    attentionRequested: false,
    ordinal: -1,
    active: false,
    calmOrdinal: -1,
  },
  on: {
    "ANIMAL_ATTENTION.INPUT_CHANGED": [
      {
        guard: "isNewEntry",
        actions: ["recordInput", "advanceChoice"],
        target: ".attention",
      },
      { guard: "isUnavailable", actions: "recordInput", target: ".resting" },
      { actions: "recordInput" },
    ],
  },
  states: {
    resting: {},
    attention: {
      on: {
        "ANIMAL_ATTENTION.COMPLETED": {
          guard: "isCurrentCompletion",
          target: "resting",
        },
      },
    },
  },
})

export default animalAttentionMachine

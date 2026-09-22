import { assign, setup } from "xstate"

export type ReactionSample = Readonly<{
  mover: "White" | "Black"
  label: "Blunder!" | "Genius!"
}>

type ReactionPlaytestContext = {
  durationMs: 3000 | 5000
  current: ReactionSample | null
  pending: ReactionSample | null
}

type ReactionPlaytestEvent =
  | { type: "DEMO.SAMPLE_REQUESTED"; sample: ReactionSample }
  | { type: "DEMO.DISMISSED" }
  | { type: "DEMO.RESET" }
  | { type: "DEMO.DURATION_CHANGED"; durationMs: 3000 | 5000 }

export default setup({
  types: {
    context: {} as ReactionPlaytestContext,
    events: {} as ReactionPlaytestEvent,
  },
  delays: { visibleDuration: ({ context }) => context.durationMs },
  guards: { hasPending: ({ context }) => context.pending !== null },
  actions: {
    clear: assign({ current: null, pending: null }),
    advance: assign({
      current: ({ context }) => context.pending,
      pending: null,
    }),
  },
}).createMachine({
  id: "reactionPlaytest",
  initial: "idle",
  context: { durationMs: 5000, current: null, pending: null },
  on: {
    "DEMO.RESET": { target: ".idle", actions: "clear" },
    "DEMO.DURATION_CHANGED": {
      target: ".idle",
      actions: [
        "clear",
        assign({ durationMs: ({ event }) => event.durationMs }),
      ],
    },
  },
  states: {
    idle: {
      on: {
        "DEMO.SAMPLE_REQUESTED": {
          target: "visible",
          actions: assign({ current: ({ event }) => event.sample }),
        },
      },
    },
    visible: {
      after: {
        visibleDuration: [
          {
            guard: "hasPending",
            target: "visible",
            reenter: true,
            actions: "advance",
          },
          { target: "idle", actions: "clear" },
        ],
      },
      on: {
        "DEMO.SAMPLE_REQUESTED": {
          actions: assign({ pending: ({ event }) => event.sample }),
        },
        "DEMO.DISMISSED": [
          {
            guard: "hasPending",
            target: "visible",
            reenter: true,
            actions: "advance",
          },
          { target: "idle", actions: "clear" },
        ],
      },
    },
  },
})

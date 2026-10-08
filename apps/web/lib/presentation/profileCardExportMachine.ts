import { assign, fromPromise, setup } from "xstate"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import type { CardInput } from "./profileCardArtwork"
import createProfileCardFile from "./profileCardExport"

const profileCardExportMachine = setup({
  types: {
    context: {} as {
      input: CardInput
      file: File | null
      failure: ErrorDiagnostic | null
    },
    input: {} as CardInput,
    events: {} as
      | { type: "CARD.PREVIEW_CHANGED"; input: CardInput }
      | { type: "CARD.RETRY_REQUESTED" },
  },
  actors: {
    render: fromPromise<File, CardInput>(({ input, signal }) =>
      createProfileCardFile(input, signal),
    ),
  },
}).createMachine({
  id: "profileCardExport",
  context: ({ input }) => ({ input, file: null, failure: null }),
  initial: "idle",
  on: {
    "CARD.PREVIEW_CHANGED": {
      actions: assign(({ event }) => ({ input: event.input, file: null })),
      target: ".preparing",
      reenter: true,
    },
  },
  states: {
    idle: {},
    preparing: {
      entry: assign({ failure: null }),
      invoke: {
        src: "render",
        input: ({ context }) => context.input,
        onDone: {
          target: "ready",
          actions: assign(({ event }) => ({ file: event.output })),
        },
        onError: {
          target: "failed",
          actions: assign(({ event }) => ({
            failure: captureError(event.error),
          })),
        },
      },
    },
    ready: {},
    failed: { on: { "CARD.RETRY_REQUESTED": "preparing" } },
  },
})
export default profileCardExportMachine

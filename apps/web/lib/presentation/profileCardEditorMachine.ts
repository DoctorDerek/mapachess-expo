import { assign, setup } from "xstate"
import {
  samePlayerAppearance as sameAppearance,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"

type EditorContext = {
  saved: PlayerAppearance
  draft: PlayerAppearance
  requested: PlayerAppearance | null
  save: (appearance: PlayerAppearance) => void
}
type EditorEvent =
  | { type: "CARD.APPEARANCE_CHANGED"; appearance: PlayerAppearance }
  | { type: "CARD.PROFILE_ACCEPTED"; appearance: PlayerAppearance }
  | { type: "CARD.SAVE_REQUESTED" }
  | { type: "CARD.DISCARD_REQUESTED" }
  | { type: "CARD.RETURN_REQUESTED" }
  | { type: "CARD.LEAVE_REQUESTED" }
  | { type: "CARD.SAVE_FAILED" }
  | { type: "CARD.RETRY_REQUESTED" }
const profileCardEditorMachine = setup({
  types: {
    context: {} as EditorContext,
    events: {} as EditorEvent,
    input: {} as {
      appearance: PlayerAppearance
      save: (appearance: PlayerAppearance) => void
    },
  },
  guards: {
    dirty: ({ context }) => !sameAppearance(context.saved, context.draft),
  },
  actions: {
    updateSaved: assign(({ context, event }) =>
      event.type === "CARD.PROFILE_ACCEPTED"
        ? {
            saved: event.appearance,
            ...(sameAppearance(context.saved, context.draft)
              ? { draft: event.appearance }
              : {}),
          }
        : {},
    ),
    changeDraft: assign(({ event }) =>
      event.type === "CARD.APPEARANCE_CHANGED"
        ? { draft: event.appearance }
        : {},
    ),
    discard: assign(({ context }) => ({
      draft: context.saved,
      requested: null,
    })),
    captureSave: assign(({ context }) => ({ requested: context.draft })),
    save: ({ context }) => context.save(context.draft),
  },
}).createMachine({
  id: "profileCardEditor",
  context: ({ input }) => ({
    saved: input.appearance,
    draft: input.appearance,
    requested: null,
    save: input.save,
  }),
  initial: "editing",
  on: { "CARD.PROFILE_ACCEPTED": { actions: "updateSaved" } },
  states: {
    editing: {
      on: {
        "CARD.APPEARANCE_CHANGED": { actions: "changeDraft" },
        "CARD.DISCARD_REQUESTED": { actions: "discard" },
        "CARD.SAVE_REQUESTED": {
          guard: "dirty",
          actions: ["captureSave", "save"],
          target: "saving",
        },
        "CARD.LEAVE_REQUESTED": { guard: "dirty", target: "confirmingDiscard" },
      },
    },
    confirmingDiscard: {
      on: {
        "CARD.RETURN_REQUESTED": "editing",
        "CARD.DISCARD_REQUESTED": { actions: "discard", target: "editing" },
        "CARD.SAVE_REQUESTED": {
          actions: ["captureSave", "save"],
          target: "saving",
        },
      },
    },
    saving: {
      on: {
        "CARD.PROFILE_ACCEPTED": {
          guard: ({ context, event }) =>
            context.requested !== null &&
            sameAppearance(context.requested, event.appearance),
          actions: assign(({ event }) => ({
            saved: event.appearance,
            draft: event.appearance,
            requested: null,
          })),
          target: "editing",
        },
        "CARD.SAVE_FAILED": "failed",
      },
    },
    failed: {
      always: {
        guard: ({ context }) =>
          context.requested !== null &&
          sameAppearance(context.saved, context.requested),
        actions: "discard",
        target: "editing",
      },
      on: { "CARD.RETRY_REQUESTED": "saving" },
    },
  },
})
export default profileCardEditorMachine

import { assign, setup } from "xstate"
import {
  samePlayerAppearance as sameAppearance,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import {
  sameCardRatingContext,
  type CardRatingContext,
} from "@mapachess/profile/rating-context"

type EditorContext = {
  saved: PlayerAppearance
  draft: PlayerAppearance
  savedRatingContext: CardRatingContext
  draftRatingContext: CardRatingContext
  requested: Readonly<{
    appearance: PlayerAppearance
    ratingContext: CardRatingContext
  }> | null
  save: (appearance: PlayerAppearance, ratingContext: CardRatingContext) => void
}
export const isProfileCardEditorDirty = (context: EditorContext): boolean =>
  !sameAppearance(context.saved, context.draft) ||
  !sameCardRatingContext(context.savedRatingContext, context.draftRatingContext)
type EditorEvent =
  | { type: "CARD.APPEARANCE_CHANGED"; appearance: PlayerAppearance }
  | { type: "CARD.RATING_CONTEXT_CHANGED"; ratingContext: CardRatingContext }
  | {
      type: "CARD.PROFILE_ACCEPTED"
      appearance: PlayerAppearance
      ratingContext: CardRatingContext
    }
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
      ratingContext: CardRatingContext
      save: EditorContext["save"]
    },
  },
  guards: {
    dirty: ({ context }) => isProfileCardEditorDirty(context),
  },
  actions: {
    updateSaved: assign(({ context, event }) =>
      event.type === "CARD.PROFILE_ACCEPTED"
        ? {
            saved: event.appearance,
            savedRatingContext: event.ratingContext,
            ...(!isProfileCardEditorDirty(context)
              ? {
                  draft: event.appearance,
                  draftRatingContext: event.ratingContext,
                }
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
      draftRatingContext: context.savedRatingContext,
      requested: null,
    })),
    changeRatingContext: assign(({ event }) =>
      event.type === "CARD.RATING_CONTEXT_CHANGED"
        ? { draftRatingContext: event.ratingContext }
        : {},
    ),
    captureSave: assign(({ context }) => ({
      requested: {
        appearance: context.draft,
        ratingContext: context.draftRatingContext,
      },
    })),
    save: ({ context }) =>
      context.save(context.draft, context.draftRatingContext),
  },
}).createMachine({
  id: "profileCardEditor",
  context: ({ input }) => ({
    saved: input.appearance,
    draft: input.appearance,
    savedRatingContext: input.ratingContext,
    draftRatingContext: input.ratingContext,
    requested: null,
    save: input.save,
  }),
  initial: "editing",
  on: { "CARD.PROFILE_ACCEPTED": { actions: "updateSaved" } },
  states: {
    editing: {
      on: {
        "CARD.APPEARANCE_CHANGED": { actions: "changeDraft" },
        "CARD.RATING_CONTEXT_CHANGED": { actions: "changeRatingContext" },
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
            sameAppearance(context.requested.appearance, event.appearance) &&
            sameCardRatingContext(
              context.requested.ratingContext,
              event.ratingContext,
            ),
          actions: assign(({ event }) => ({
            saved: event.appearance,
            draft: event.appearance,
            savedRatingContext: event.ratingContext,
            draftRatingContext: event.ratingContext,
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
          sameAppearance(context.saved, context.requested.appearance) &&
          sameCardRatingContext(
            context.savedRatingContext,
            context.requested.ratingContext,
          ),
        actions: "discard",
        target: "editing",
      },
      on: { "CARD.RETRY_REQUESTED": "saving" },
    },
  },
})
export default profileCardEditorMachine

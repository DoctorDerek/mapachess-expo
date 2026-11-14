import { assign, setup, type ActorRefFrom } from "xstate"
import type { ChallengeDifficultyEdit } from "./challengeDifficulty.js"
import challengeDifficultyGrid, {
  editChallengeDifficulty,
} from "./challengeDifficulty.js"
import createMatchSetupDraft, {
  type MatchSetupDraft,
  type MatchSetupDraftInput,
  type SetupEditorValues,
} from "./matchSetup.js"

export type MatchSetupDraftEvent =
  | Readonly<{
      type: "MATCH_SETUP.OPPONENT_SELECTED"
      opponentId: SetupEditorValues["opponent"]
    }>
  | Readonly<{
      type: "MATCH_SETUP.TIME_CONTROL_SELECTED"
      control: SetupEditorValues["time-control"]
    }>
  | Readonly<{
      type: "MATCH_SETUP.COLOR_SELECTED"
      color: MatchSetupDraft["playerColor"]
    }>
  | Readonly<{
      type: "MATCH_SETUP.DIFFICULTY_EDITED"
      edit: ChallengeDifficultyEdit
    }>
  | Readonly<{ type: "MATCH_SETUP.POSITION_TYPED"; value: string }>
  | Readonly<{ type: "MATCH_SETUP.POSITION_RANDOMIZED" }>
  | Readonly<{ type: "MATCH_SETUP.SUBMISSION_REJECTED" }>

const matchSetupMachine = setup({
  types: {
    context: {} as MatchSetupDraft,
    input: {} as MatchSetupDraftInput,
    events: {} as MatchSetupDraftEvent,
  },
}).createMachine({
  id: "matchSetupDraft",
  context: ({ input }) => createMatchSetupDraft(input),
  on: {
    "MATCH_SETUP.OPPONENT_SELECTED": {
      actions: assign({ opponentId: ({ event }) => event.opponentId }),
    },
    "MATCH_SETUP.TIME_CONTROL_SELECTED": {
      actions: assign({ timeControl: ({ event }) => event.control }),
    },
    "MATCH_SETUP.COLOR_SELECTED": {
      actions: assign({ playerColor: ({ event }) => event.color }),
    },
    "MATCH_SETUP.DIFFICULTY_EDITED": {
      actions: assign({
        difficulty: ({ context, event }) =>
          context.difficulty === null
            ? null
            : editChallengeDifficulty(
                challengeDifficultyGrid(context.variant),
                context.difficulty,
                event.edit,
              ),
      }),
    },
    "MATCH_SETUP.POSITION_TYPED": {
      actions: assign({
        positionText: ({ event }) => event.value,
        numberedPosition: true,
        invalidSetup: false,
      }),
    },
    "MATCH_SETUP.POSITION_RANDOMIZED": {
      actions: assign({
        positionText: ({ context }) => String(context.generatePosition()),
        numberedPosition: false,
        invalidSetup: false,
      }),
    },
    "MATCH_SETUP.SUBMISSION_REJECTED": {
      actions: assign({ invalidSetup: true }),
    },
  },
})

export const setupEditorMachine = setup({
  types: {
    context: {} as SetupEditorValues,
    input: {} as SetupEditorValues,
    events: {} as
      | Readonly<{
          type: "SETUP_EDITOR.PLAYER_SELECTED"
          player: NonNullable<SetupEditorValues["player"]>
        }>
      | Readonly<{
          type: "SETUP_EDITOR.OPPONENT_SELECTED"
          opponent: SetupEditorValues["opponent"]
        }>
      | Readonly<{
          type: "SETUP_EDITOR.HINTS_SELECTED"
          hints: SetupEditorValues["hints"]
        }>
      | Readonly<{
          type: "SETUP_EDITOR.TIME_CONTROL_SELECTED"
          control: SetupEditorValues["time-control"]
        }>,
  },
}).createMachine({
  id: "setupEditorDraft",
  context: ({ input }) => input,
  on: {
    "SETUP_EDITOR.PLAYER_SELECTED": {
      actions: assign({ player: ({ event }) => event.player }),
    },
    "SETUP_EDITOR.OPPONENT_SELECTED": {
      actions: assign({ opponent: ({ event }) => event.opponent }),
    },
    "SETUP_EDITOR.HINTS_SELECTED": {
      actions: assign({ hints: ({ event }) => event.hints }),
    },
    "SETUP_EDITOR.TIME_CONTROL_SELECTED": {
      actions: assign({ "time-control": ({ event }) => event.control }),
    },
  },
})

export type MatchSetupDraftActor = ActorRefFrom<typeof matchSetupMachine>
export default matchSetupMachine

import { useActorRef, useSelector } from "@xstate/react"
import {
  canAcceptSetupEditor,
  type SetupEditor,
  type SetupEditorValues,
} from "@mapachess/gameplay/match-setup"
import { setupEditorMachine } from "@mapachess/gameplay/match-setup-machine"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  selectChallengeUnlockedOpponents,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import SetupAnimalChoices, {
  SetupOpponentChoices,
  SetupStoryChoices,
} from "./SetupAnimalChoices.js"
import SetupChoices, { SetupClockChoices } from "./SetupChoices.js"
import type { SetupElements } from "./setupElements.js"

export default function MatchSetupEditor({
  editor,
  initialValues,
  onDone,
  onCancel,
  disabled,
  active,
  visible = true,
  mode,
  variant,
  storyProgress,
  copy,
  elements,
}: Readonly<{
  editor: SetupEditor
  initialValues: SetupEditorValues
  onDone: (values: SetupEditorValues) => void
  onCancel: () => void
  disabled: boolean
  active: boolean
  visible?: boolean
  mode: MatchSetup["mode"]
  variant: MatchVariant
  storyProgress: StoryProgress
  copy: MapachessCatalog
  elements: SetupElements
}>) {
  const actor = useActorRef(setupEditorMachine, { input: initialValues })
  const draft = useSelector(actor, (snapshot) => snapshot.context)
  const { Editor, Group, Text, Action } = elements
  const titles = {
    player: copy.setup.color,
    opponent: copy.setup.chooseOpponent,
    hints: copy.setup.betterHints,
    "time-control": copy.gameplay.clock.timeControl,
  } satisfies Readonly<Record<SetupEditor, string>>
  const canAccept =
    !disabled &&
    canAcceptSetupEditor(editor, draft, variant, mode, storyProgress)
  return (
    <Editor
      title={titles[editor]}
      active={visible}
      focusSelection={editor === "opponent" || editor === "player"}
      fitContent={editor === "opponent" && mode === "challenge"}
      onCancel={onCancel}
      actions={
        <Group className="flex flex-row flex-wrap gap-2">
          <Action
            className="min-w-0 flex-1 basis-28 px-2!"
            disabled={false}
            secondary
            onActivate={onCancel}
          >
            {copy.setup.cancel}
          </Action>
          <Action
            label={copy.setup.done}
            className="min-w-0 flex-1 basis-28 px-2!"
            disabled={!canAccept}
            onActivate={() => {
              if (canAccept) onDone(actor.getSnapshot().context)
            }}
          >
            ✓ {copy.setup.done}
          </Action>
        </Group>
      }
    >
      {editor === "player" && draft.player !== undefined ? (
        <Group className="bg-mapachito-charcoal rounded-lg p-3">
          <SetupAnimalChoices
            copy={copy}
            elements={elements}
            active={active}
            presentation="dialog"
            disabled={disabled}
            onSelected={(player) =>
              actor.send({ type: "SETUP_EDITOR.PLAYER_SELECTED", player })
            }
            selectedId={draft.player}
            storyProgress={storyProgress}
          />
        </Group>
      ) : null}
      {editor === "opponent" ? (
        mode === "story" ? (
          <SetupStoryChoices
            copy={copy}
            elements={elements}
            active={active}
            progress={storyProgress}
            variant={variant}
            selection={{
              disabled,
              opponentId: draft.opponent,
              onSelected: (opponent) =>
                actor.send({
                  type: "SETUP_EDITOR.OPPONENT_SELECTED",
                  opponent,
                }),
            }}
          />
        ) : (
          <SetupOpponentChoices
            copy={copy}
            elements={elements}
            active={active}
            disabled={disabled}
            selectedId={draft.opponent}
            unlockedOpponents={selectChallengeUnlockedOpponents(storyProgress)}
            onSelected={(opponent) =>
              actor.send({ type: "SETUP_EDITOR.OPPONENT_SELECTED", opponent })
            }
          />
        )
      ) : null}
      {editor === "hints" ? (
        <SetupChoices
          copy={copy}
          elements={elements}
          disabled={disabled}
          autoHintMode={draft.hints}
          onChange={(hints) =>
            actor.send({ type: "SETUP_EDITOR.HINTS_SELECTED", hints })
          }
        />
      ) : null}
      {editor === "time-control" ? (
        <Group className="flex flex-col gap-3">
          <SetupClockChoices
            copy={copy}
            elements={elements}
            disabled={disabled}
            control={draft["time-control"]}
            onChange={(control) =>
              actor.send({
                type: "SETUP_EDITOR.TIME_CONTROL_SELECTED",
                control,
              })
            }
          />
          <Text role="status" className="text-mapachito-charcoal">
            {draft["time-control"].type === "untimed"
              ? copy.gameplay.clock.untimedExplanation
              : copy.gameplay.clock.explanation(
                  draft["time-control"].baseSeconds / 60,
                  draft["time-control"].incrementSeconds,
                )}
          </Text>
        </Group>
      ) : null}
    </Editor>
  )
}

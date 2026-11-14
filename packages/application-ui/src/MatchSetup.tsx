import { useActorRef, useSelector } from "@xstate/react"
import cx from "classix"
import { useCallback, type ReactNode } from "react"
import type { ChallengeDifficultyEdit } from "@mapachess/gameplay/challenge-difficulty"
import {
  prepareMatchSetupSubmission,
  selectMatchSetup,
  type SetupEditor,
  type SetupSource,
} from "@mapachess/gameplay/match-setup"
import matchSetupMachine from "@mapachess/gameplay/match-setup-machine"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { Chess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchSetup as MatchSetupRequest } from "@mapachess/match/match-setup"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import { timeControlLabel } from "@mapachess/match/time-control"
import ChallengeDifficulty from "./ChallengeDifficulty.js"
import MatchSetupEditor from "./MatchSetupEditor.js"
import { SetupColorChoices, SetupPositionChoice } from "./SetupChoices.js"
import type { SetupElements } from "./setupElements.js"

export type MatchSetupProps = SetupSource &
  Readonly<{
    header?: ReactNode
    initial: MatchSetupRequest
    generatePosition: () => Chess960PositionId
    disabled: boolean
    opening?: boolean
    visible: boolean
    editing: SetupEditor | null
    editorVisible?: boolean
    onEditorOpened: (editor: SetupEditor) => void
    onEditorClosed: () => void
    onStart: (setup: MatchSetupRequest) => void
    onBack: () => void
    onAutoHintModeChanged: (mode: AutoHintMode) => void
    onPlayerAnimalChanged?: ((animal: StockfishOpponentId) => void) | undefined
    focusDifficulty: () => void
    copy: MapachessCatalog
    elements: SetupElements
  }>

export default function MatchSetup(props: MatchSetupProps) {
  const {
    initial,
    copy,
    elements,
    disabled,
    opening = false,
    editing,
    visible,
    editorVisible = true,
    onEditorOpened,
    onEditorClosed,
    onPlayerAnimalChanged,
  } = props
  const actor = useActorRef(matchSetupMachine, {
    input: {
      initial,
      storyProgress: props.storyProgress,
      generatePosition: props.generatePosition,
    },
  })
  const draft = useSelector(actor, (snapshot) => snapshot.context)
  const changeDifficulty = useCallback(
    (edit: ChallengeDifficultyEdit): void => {
      actor.send({ type: "MATCH_SETUP.DIFFICULTY_EDITED", edit })
    },
    [actor],
  )
  const view = selectMatchSetup(draft, props)
  const { Surface, Group, Text, Action, Animal, Medal } = elements
  const blocked = disabled || opening
  const start = (): void => {
    const result = prepareMatchSetupSubmission(
      actor.getSnapshot().context,
      props,
      blocked || editing !== null,
    )
    if (result.type === "ready") props.onStart(result.setup)
    else if (result.type === "difficulty") {
      props.focusDifficulty()
      actor.send({
        type: "MATCH_SETUP.DIFFICULTY_EDITED",
        edit: { type: "committed" },
      })
    } else if (result.type === "invalid")
      actor.send({ type: "MATCH_SETUP.SUBMISSION_REJECTED" })
  }
  const choice = (
    editor: SetupEditor,
    label: string,
    value: string,
    actionLabel: string,
    animal?: typeof view.opponent,
    detail?: string,
  ) => (
    <Group className="flex min-w-0 flex-row flex-wrap items-center gap-2">
      {animal === undefined ? null : (
        <Animal
          opponent={animal}
          active={visible && editing === null && !blocked}
          prepare={editor === "opponent" && visible}
        />
      )}
      <Group className="flex min-w-0 flex-1 basis-40 flex-row flex-wrap items-center gap-2">
        <Group className="min-w-0 flex-1 basis-16">
          <Text className="text-mapachito-charcoal text-sm font-semibold">
            {label}
          </Text>
          <Text className="font-display text-mapachito-charcoal text-xl leading-tight font-black">
            {value}
          </Text>
          {detail === undefined ? null : (
            <Text className="text-mapachito-charcoal font-semibold">
              {detail}
            </Text>
          )}
        </Group>
        <Action
          label={actionLabel}
          disabled={blocked}
          secondary
          opensEditor
          className="px-2! py-2! text-base"
          onActivate={() => onEditorOpened(editor)}
        >
          {copy.setup.change}
        </Action>
      </Group>
    </Group>
  )
  return (
    <>
      <Surface
        onSubmit={start}
        className={cx(
          "mx-auto h-full min-h-0 w-full max-w-3xl",
          view.chess960Challenge && "xl:max-w-4xl",
        )}
        actions={
          <Group className="flex flex-row gap-2">
            <Action
              className="min-w-0 flex-1 px-0! py-1! text-base wrap-break-word"
              disabled={disabled}
              secondary
              onActivate={props.onBack}
            >
              {copy.setup.allModes}
            </Action>
            <Action
              label={copy.setup.startMatch}
              submit
              className="min-w-0 flex-1 px-0! py-1! text-base wrap-break-word"
              disabled={disabled || !view.available}
              busy={opening}
              busyLabel={copy.setup.openingMatch}
              onActivate={start}
            >
              ▶ {copy.setup.startMatch}
            </Action>
          </Group>
        }
      >
        {props.header}
        <Text
          kind="heading"
          className="font-display text-mapachito-white mb-4 text-2xl leading-tight font-black wrap-anywhere"
        >
          {copy.setup.presentations[draft.variant][initial.mode].title}
        </Text>
        <Group className="flex min-w-0 flex-col gap-3">
          <Group
            className={cx(
              "border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal flex min-w-0 flex-col gap-5 rounded-xl border-3 p-4 wrap-anywhere",
              view.chess960Challenge && "xl:flex-row",
            )}
          >
            <Group className="flex min-w-0 flex-1 flex-col gap-5">
              {initial.mode === "story" &&
              view.playerAnimal !== null &&
              onPlayerAnimalChanged !== undefined
                ? choice(
                    "player",
                    copy.setup.color,
                    copy.animals.names[view.playerAnimal.id],
                    copy.setup.playAsAction(
                      copy.animals.names[view.playerAnimal.id],
                    ),
                    view.playerAnimal,
                  )
                : null}
              {choice(
                "opponent",
                copy.setup.opponent,
                copy.animals.opponent(view.opponent.id),
                initial.mode === "story"
                  ? copy.setup.changeStoryOpponent
                  : copy.setup.changeAnimal,
                view.opponent,
                initial.mode === "story"
                  ? copy.setup.elo(String(view.opponent.storyTargetElo))
                  : undefined,
              )}
              {view.difficulty === null ? null : (
                <>
                  <ChallengeDifficulty
                    control={view.difficulty}
                    disabled={blocked}
                    onEdit={changeDifficulty}
                    copy={copy}
                    elements={elements}
                  />
                  <SetupColorChoices
                    copy={copy}
                    elements={elements}
                    disabled={blocked}
                    value={draft.playerColor}
                    onChange={(color) =>
                      actor.send({ type: "MATCH_SETUP.COLOR_SELECTED", color })
                    }
                  />
                </>
              )}
              {choice(
                "hints",
                copy.setup.betterHints,
                copy.setup.autoHints[props.autoHintMode].label,
                copy.setup.changeHints,
              )}
              {choice(
                "time-control",
                copy.gameplay.clock.timeControl,
                timeControlLabel(draft.timeControl, copy.gameplay.clock),
                copy.gameplay.clock.change,
              )}
              {view.rating === null ? null : (
                <Group className="flex flex-row flex-wrap items-center gap-1">
                  <Medal medal={view.assistance} />
                  <Text className="text-mapachito-charcoal font-bold">
                    {copy.profile.rating(
                      copy.gameplay.clock.rating(
                        copy.setup.variants[draft.variant],
                        copy.gameplay.clock.category[view.category],
                        copy.shared.story.medals[view.assistance],
                      ),
                      view.rating.value,
                    )}
                  </Text>
                </Group>
              )}
            </Group>
            {view.chess960Challenge ? (
              <Group className="border-mapachito-charcoal/25 min-w-0 border-t pt-4 xl:w-64 xl:shrink-0 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
                <SetupPositionChoice
                  copy={copy}
                  elements={elements}
                  disabled={blocked}
                  value={draft.positionText}
                  orientation={
                    draft.playerColor === "black" ? "black" : "white"
                  }
                  onChanged={(value) =>
                    actor.send({ type: "MATCH_SETUP.POSITION_TYPED", value })
                  }
                  onRandomize={() =>
                    actor.send({ type: "MATCH_SETUP.POSITION_RANDOMIZED" })
                  }
                />
              </Group>
            ) : null}
          </Group>
          {!view.available ? (
            <Text
              role="status"
              className="bg-mapachito-white text-mapachito-charcoal rounded-lg p-3 font-semibold"
            >
              {copy.setup.unavailableSelection}
            </Text>
          ) : null}
          {draft.invalidSetup ? (
            <Text
              role="alert"
              className="bg-mapachito-white text-mapachito-charcoal rounded-lg p-3 font-semibold"
            >
              {copy.setup.invalidSetup}
            </Text>
          ) : null}
          {initial.mode === "story" ? (
            <Text className="text-mapachito-white text-sm">
              {copy.setup.randomColor}
            </Text>
          ) : null}
        </Group>
      </Surface>
      {editing === null ? null : (
        <MatchSetupEditor
          key={editing}
          editor={editing}
          active={visible && editorVisible}
          visible={editorVisible}
          disabled={blocked}
          mode={initial.mode}
          variant={draft.variant}
          storyProgress={props.storyProgress}
          initialValues={{
            player: props.playerAppearance?.animal,
            opponent: draft.opponentId,
            hints: props.autoHintMode,
            "time-control": draft.timeControl,
          }}
          onCancel={onEditorClosed}
          copy={copy}
          elements={elements}
          onDone={(values) => {
            switch (editing) {
              case "player":
                if (values.player !== undefined)
                  onPlayerAnimalChanged?.(values.player)
                break
              case "opponent":
                actor.send({
                  type: "MATCH_SETUP.OPPONENT_SELECTED",
                  opponentId: values.opponent,
                })
                break
              case "hints":
                props.onAutoHintModeChanged(values.hints)
                break
              case "time-control":
                actor.send({
                  type: "MATCH_SETUP.TIME_CONTROL_SELECTED",
                  control: values["time-control"],
                })
                break
            }
            onEditorClosed()
          }}
        />
      )}
    </>
  )
}

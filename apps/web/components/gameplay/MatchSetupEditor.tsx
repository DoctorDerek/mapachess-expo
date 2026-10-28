import { useState, type ReactNode } from "react"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import type { TimeControl } from "@mapachess/match/time-control"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  selectChallengeUnlockedOpponents,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import AutoHintModeChoices from "../profile/AutoHintModeChoices"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import PlayerAnimalChoices from "../profile/PlayerAnimalChoices"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"
import ChallengeOpponentChoices from "./ChallengeOpponentChoices"
import MatchSetupPicker from "./MatchSetupPicker"
import StoryLadderProgress from "./StoryLadderProgress"
import TimeControlChoices from "./TimeControlChoices"

export type SetupEditorValues = Readonly<{
  player: StockfishOpponentId | undefined
  opponent: StockfishOpponentId
  difficulty: number | undefined
  hints: AutoHintMode
  "time-control": TimeControl
}>

export type SetupEditor = keyof SetupEditorValues

export default function MatchSetupEditor({
  editor,
  initialValues,
  onDone,
  onCancel,
  disabled,
  active,
  mode,
  variant,
  storyProgress,
  challengeHistory,
  difficultyTargets,
}: Readonly<{
  editor: SetupEditor
  initialValues: SetupEditorValues
  onDone: (values: SetupEditorValues) => void
  onCancel: () => void
  disabled: boolean
  active: boolean
  mode: MatchSetup["mode"]
  variant: MatchVariant
  storyProgress: StoryProgress
  challengeHistory: MapachessPlayerData["challengeHistory"]
  difficultyTargets: readonly number[]
}>) {
  const catalog = useMapachessCopy()
  const copy = catalog.setup
  const clockCopy = catalog.gameplay.clock
  const [draft, setDraft] = useState(initialValues)
  const titles = {
    player: copy.color,
    opponent: copy.chooseOpponent,
    difficulty: copy.chooseDifficulty,
    hints: copy.betterHints,
    "time-control": clockCopy.timeControl,
  } satisfies Readonly<Record<SetupEditor, string>>
  let choices: ReactNode
  switch (editor) {
    case "player":
      choices =
        draft.player === undefined ? null : (
          <div className="bg-mapachito-charcoal rounded-lg p-3">
            <PlayerAnimalChoices
              active={active}
              presentation="dialog"
              disabled={disabled}
              onSelected={(player) => setDraft({ ...draft, player })}
              selectedId={draft.player}
              storyProgress={storyProgress}
            />
          </div>
        )
      break
    case "time-control": {
      const control = draft["time-control"]
      choices = (
        <div className="grid gap-3">
          <TimeControlChoices
            control={control}
            disabled={disabled}
            onChange={(control) =>
              setDraft({ ...draft, "time-control": control })
            }
          />
          <p role="status" aria-live="polite">
            {control.type === "untimed"
              ? clockCopy.untimedExplanation
              : clockCopy.explanation(
                  control.baseSeconds / 60,
                  control.incrementSeconds,
                )}
          </p>
        </div>
      )
      break
    }
    case "hints":
      choices = (
        <AutoHintModeChoices
          autoHintMode={draft.hints}
          disabled={disabled}
          onAutoHintModeChanged={(hints) => setDraft({ ...draft, hints })}
        />
      )
      break
    case "difficulty":
      choices = (
        <ChallengeDifficultyChoices
          disabled={disabled}
          history={challengeHistory[variant]}
          onSelected={(difficulty) => setDraft({ ...draft, difficulty })}
          selectedElo={draft.difficulty}
          targets={difficultyTargets}
        />
      )
      break
    case "opponent":
      choices =
        mode === "story" ? (
          <StoryLadderProgress
            progress={storyProgress}
            variant={variant}
            selection={{
              disabled,
              opponentId: draft.opponent,
              onSelected: (opponent) => setDraft({ ...draft, opponent }),
            }}
          />
        ) : (
          <ChallengeOpponentChoices
            disabled={disabled}
            onSelected={(opponent) => setDraft({ ...draft, opponent })}
            opponents={selectChallengeUnlockedOpponents(storyProgress)}
            selectedId={draft.opponent}
          />
        )
      break
  }
  return (
    <MatchSetupPicker
      onCancel={onCancel}
      onDone={() => onDone(draft)}
      disabled={
        disabled ||
        (editor === "player" && draft.player === undefined) ||
        (editor === "difficulty" && draft.difficulty === undefined)
      }
      title={titles[editor]}
    >
      {choices}
    </MatchSetupPicker>
  )
}

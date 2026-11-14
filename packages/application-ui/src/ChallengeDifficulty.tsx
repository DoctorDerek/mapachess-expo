import { useId } from "react"
import type {
  ChallengeDifficultyControlState,
  ChallengeDifficultyEdit,
} from "@mapachess/gameplay/challenge-difficulty"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { SetupElements } from "./setupElements.js"

export default function ChallengeDifficulty({
  control,
  disabled,
  onEdit,
  copy,
  elements,
}: Readonly<{
  control: ChallengeDifficultyControlState
  disabled: boolean
  onEdit: (edit: ChallengeDifficultyEdit) => void
  copy: MapachessCatalog
  elements: SetupElements
}>) {
  const { Group, Text, ExactElo, Slider, Medal } = elements
  const inputId = useId()
  const errorId = useId()
  const input = { control, disabled, onEdit, inputId, errorId }
  const { minimum, maximum, step } = control.grid
  const record =
    control.history.type === "played" ? control.history.record : null
  return (
    <Group
      kind="fieldset"
      disabled={disabled}
      className="flex min-w-0 flex-col gap-1"
    >
      <Group className="flex flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-mapachito-charcoal font-bold">
          {copy.setup.opponentElo}
        </Text>
        <ExactElo {...input} />
      </Group>
      <Slider {...input} />
      <Group className="flex flex-row justify-between gap-2">
        <Text
          decorative
          className="text-mapachito-charcoal text-sm font-semibold tabular-nums"
        >
          {minimum}
        </Text>
        <Text
          decorative
          className="text-mapachito-charcoal text-sm font-semibold tabular-nums"
        >
          {maximum}
        </Text>
      </Group>
      {control.showError ? (
        <Text
          id={errorId}
          role="alert"
          className="text-mapachito-charcoal text-sm font-bold"
        >
          {copy.setup.invalidOpponentElo(minimum, maximum, step)}
        </Text>
      ) : null}
      {record !== null ? (
        <Group className="flex flex-row flex-wrap items-start gap-x-5 gap-y-1 pt-1">
          {record.highestMedal === null ? null : (
            <Group className="min-w-0">
              <Text className="text-mapachito-charcoal text-sm font-semibold">
                {copy.setup.bestDifficultyMedal}
              </Text>
              <Group className="flex flex-row items-center gap-1">
                <Medal medal={record.highestMedal} />
                <Text className="text-mapachito-charcoal font-bold">
                  {copy.shared.story.medals[record.highestMedal]}
                </Text>
              </Group>
            </Group>
          )}
          <Group className="min-w-0">
            <Text className="text-mapachito-charcoal text-sm font-semibold">
              {copy.setup.lastDifficultyOpponent}
            </Text>
            <Text className="text-mapachito-charcoal font-bold">
              {copy.animals.opponent(record.lastPlayedAnimal)}
            </Text>
          </Group>
        </Group>
      ) : control.history.type === "unplayed" ? (
        <Text className="text-mapachito-charcoal pt-1 text-sm">
          {copy.setup.noDifficultyHistory}
        </Text>
      ) : null}
    </Group>
  )
}

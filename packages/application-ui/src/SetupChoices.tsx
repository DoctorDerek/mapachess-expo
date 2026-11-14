import { useId } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import {
  AUTO_HINT_MODE_PRESENTATION,
  AUTO_HINT_MODES,
  type AutoHintMode,
} from "@mapachess/match/auto-hint-mode"
import type { ChallengePositionSetup } from "@mapachess/match/challenge-setup"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
  timeControlsEqual,
  type TimeControl,
} from "@mapachess/match/time-control"
import type { SetupElements, SetupPositionProps } from "./setupElements.js"

type Common = Readonly<{
  copy: MapachessCatalog
  elements: SetupElements
  disabled: boolean
}>

export function SetupPositionChoice({
  copy,
  elements,
  onRandomize,
  ...input
}: Common & SetupPositionProps & Readonly<{ onRandomize: () => void }>) {
  const { Group, Text, Action, PositionInput, PositionPreview } = elements
  return (
    <Group className="min-w-0">
      <Text className="text-mapachito-charcoal font-bold">
        {copy.setup.position}
      </Text>
      <Group className="mt-2 flex flex-row flex-wrap items-end gap-2">
        <PositionInput {...input} />
        <Action
          label={copy.setup.randomize}
          disabled={input.disabled}
          secondary
          className="max-w-full min-w-0 px-2! wrap-break-word"
          onActivate={onRandomize}
        >
          ⤨ {copy.setup.randomize}
        </Action>
      </Group>
      <PositionPreview value={input.value} orientation={input.orientation} />
    </Group>
  )
}

export default function SetupChoices({
  copy,
  elements,
  disabled,
  autoHintMode,
  onChange,
  onExplain,
}: Common &
  Readonly<{
    autoHintMode: AutoHintMode
    onChange: (mode: AutoHintMode) => void
    onExplain?: (() => void) | undefined
  }>) {
  const { Group, Text, Action, Choice, Medal } = elements
  const name = useId()
  return (
    <Group kind="fieldset" disabled={disabled} className="min-w-0">
      <Text
        kind="legend"
        className="text-mapachito-charcoal text-lg font-black"
      >
        {copy.setup.betterHints}
      </Text>
      {onExplain === undefined ? null : (
        <Action
          disabled={disabled}
          label={copy.shared.settingsControls.explainAutoHints}
          secondary
          onActivate={onExplain}
        >
          ?
        </Action>
      )}
      <Text className="text-mapachito-charcoal mt-2 text-sm leading-relaxed">
        {copy.setup.hintMedalExplanation}
      </Text>
      <Group className="mt-4 flex flex-col gap-3">
        {AUTO_HINT_MODES.map((mode) => (
          <Choice
            key={mode}
            name={name}
            value={mode}
            selected={autoHintMode === mode}
            disabled={disabled}
            onSelected={() => onChange(mode)}
            label={copy.setup.autoHints[mode].label}
            className="border-mapachito-charcoal/30 bg-mapachito-white flex min-h-12 flex-row items-start gap-3 rounded-lg border-2 p-4"
          >
            {() => (
              <Group className="min-w-0 flex-1">
                <Text className="text-mapachito-charcoal font-black">
                  {copy.setup.autoHints[mode].label}
                </Text>
                {onExplain === undefined ? (
                  <Text className="text-mapachito-charcoal mt-1 text-sm leading-relaxed">
                    {copy.setup.autoHints[mode].description}
                  </Text>
                ) : null}
                <Group className="mt-2 flex flex-row items-center gap-1">
                  <Medal medal={AUTO_HINT_MODE_PRESENTATION[mode].medalTier} />
                  <Text className="text-mapachito-violet text-sm font-bold">
                    {copy.setup.autoHints[mode].medal}
                  </Text>
                </Group>
              </Group>
            )}
          </Choice>
        ))}
      </Group>
    </Group>
  )
}

export function SetupClockChoices({
  copy,
  elements,
  disabled,
  control,
  onChange,
}: Common &
  Readonly<{
    control: TimeControl
    onChange: (control: TimeControl) => void
  }>) {
  const { Group, Text, Choice } = elements
  const name = useId()
  return (
    <Group kind="fieldset" disabled={disabled} className="min-w-0">
      <Text kind="legend" className="sr-only">
        {copy.gameplay.clock.timeControl}
      </Text>
      <Group className="mt-2 flex flex-row flex-wrap gap-2">
        {TIME_CONTROL_PRESETS.map((preset) => (
          <Choice
            key={preset.id}
            name={name}
            value={preset.id}
            selected={timeControlsEqual(preset.control, control)}
            disabled={disabled}
            onSelected={() => onChange(preset.control)}
            className="border-mapachito-charcoal/30 flex min-h-12 min-w-0 shrink grow basis-36 flex-row items-center gap-2 rounded-lg border-2 px-3 py-2"
          >
            {() => (
              <Text className="text-mapachito-charcoal font-semibold">
                {timeControlLabel(preset.control, copy.gameplay.clock)}
              </Text>
            )}
          </Choice>
        ))}
      </Group>
    </Group>
  )
}

export function SetupColorChoices({
  copy,
  elements,
  disabled,
  value,
  onChange,
}: Common &
  Readonly<{
    value: ChallengePositionSetup["playerColor"]
    onChange: (color: ChallengePositionSetup["playerColor"]) => void
  }>) {
  const { Group, Text, Choice } = elements
  const name = useId()
  return (
    <Group kind="fieldset" disabled={disabled} className="min-w-0">
      <Text kind="legend" className="font-bold">
        {copy.setup.color}
      </Text>
      <Group className="mt-2 flex flex-row flex-wrap gap-2">
        {(["white", "black", "random"] as const).map((color) => (
          <Choice
            key={color}
            name={name}
            value={color}
            selected={value === color}
            disabled={disabled}
            onSelected={() => onChange(color)}
            className="border-mapachito-charcoal/30 flex min-h-12 min-w-0 shrink grow basis-24 flex-row items-center justify-center gap-1 rounded-lg border-2 px-1.5 py-2"
          >
            {() => (
              <Text className="text-mapachito-charcoal">
                {copy.setup[color]}
              </Text>
            )}
          </Choice>
        ))}
      </Group>
    </Group>
  )
}

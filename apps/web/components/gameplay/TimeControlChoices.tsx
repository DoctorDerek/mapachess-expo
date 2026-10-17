import cx from "classix"
import { useId } from "react"
import {
  TIME_CATEGORIES,
  TIME_CONTROL_PRESETS,
  timeCategory,
  timeControlNotation,
  timeControlsEqual,
  type TimeCategory,
  type TimeControl,
} from "@mapachess/match/time-control"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

function ClockChoices<Value extends string>({
  choices,
  selected,
  disabled,
  onChange,
  presetGrid = false,
}: Readonly<{
  choices: readonly Readonly<{ value: Value; label: string }>[]
  selected: Value
  disabled: boolean
  onChange: (value: Value) => void
  presetGrid?: boolean
}>) {
  const copy = useMapachessCopy().gameplay.clock
  const name = useId()
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">{copy.timeControl}</legend>
      <div
        className={cx(
          "mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-2",
          presetGrid && "xl:grid-cols-3",
        )}
      >
        {choices.map(({ value, label }) => (
          <label
            key={value}
            className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 font-semibold has-focus-visible:outline-3 has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={selected === value}
              onChange={() => onChange(value)}
              className="accent-mapachito-violet size-4 shrink-0"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function TimeControlChoices({
  control,
  disabled,
  onChange,
}: Readonly<{
  control: TimeControl
  disabled: boolean
  onChange: (control: TimeControl) => void
}>) {
  const copy = useMapachessCopy().gameplay.clock
  const selected = TIME_CONTROL_PRESETS.find((preset) =>
    timeControlsEqual(preset.control, control),
  )
  if (selected === undefined)
    throw new Error("A selected clock must be a supported preset.")
  return (
    <ClockChoices
      presetGrid
      choices={TIME_CONTROL_PRESETS.map(({ id, control: preset }) => ({
        value: id,
        label:
          preset.type === "untimed"
            ? copy.category.untimed
            : copy.preset(
                copy.category[timeCategory(preset)],
                timeControlNotation(preset),
              ),
      }))}
      selected={selected.id}
      disabled={disabled}
      onChange={(id) => {
        const preset = TIME_CONTROL_PRESETS.find((choice) => choice.id === id)
        if (preset !== undefined) onChange(preset.control)
      }}
    />
  )
}

export function TimeCategoryChoices({
  category,
  disabled,
  onChange,
}: Readonly<{
  category: TimeCategory
  disabled: boolean
  onChange: (category: TimeCategory) => void
}>) {
  const copy = useMapachessCopy().gameplay.clock
  return (
    <ClockChoices
      choices={TIME_CATEGORIES.map((value) => ({
        value,
        label: copy.category[value],
      }))}
      selected={category}
      disabled={disabled}
      onChange={onChange}
    />
  )
}

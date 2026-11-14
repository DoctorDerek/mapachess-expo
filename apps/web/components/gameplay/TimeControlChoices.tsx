import { useId } from "react"
import {
  TIME_CATEGORIES,
  type TimeCategory,
} from "@mapachess/match/time-control"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"

function ClockChoices<Value extends string>({
  choices,
  selected,
  disabled,
  onChange,
}: Readonly<{
  choices: readonly Readonly<{ value: Value; label: string }>[]
  selected: Value
  disabled: boolean
  onChange: (value: Value) => void
}>) {
  const copy = useMapachessCopy().gameplay.clock
  const name = useId()
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">{copy.timeControl}</legend>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-2">
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
export default TimeCategoryChoices

import { useId } from "react"
import {
  AUTO_HINT_MEDAL_EXPLANATION,
  AUTO_HINT_MODE_PRESENTATION,
  AUTO_HINT_MODES,
  type AutoHintMode,
} from "@mapachess/match/auto-hint-mode"

export type AutoHintModeChoicesProps = Readonly<{
  autoHintMode: AutoHintMode
  disabled: boolean
  onAutoHintModeChanged: (mode: AutoHintMode) => void
}>

export default function AutoHintModeChoices({
  autoHintMode,
  disabled,
  onAutoHintModeChanged,
}: AutoHintModeChoicesProps) {
  const groupId = useId()

  return (
    <fieldset
      aria-describedby={`${groupId}-explanation`}
      className="min-w-0"
      disabled={disabled}
    >
      <legend className="text-mapachito-charcoal text-lg font-black">
        Better Hints
      </legend>
      <p
        className="text-mapachito-charcoal mt-2 text-sm leading-relaxed"
        id={`${groupId}-explanation`}
      >
        {AUTO_HINT_MEDAL_EXPLANATION}
      </p>
      <div className="mt-4 grid gap-3">
        {AUTO_HINT_MODES.map((mode) => {
          const choice = AUTO_HINT_MODE_PRESENTATION[mode]
          const controlId = `${groupId}-${mode}`
          return (
            <label
              className="border-mapachito-charcoal/30 bg-mapachito-white has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/8 flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border-2 p-4 has-disabled:cursor-not-allowed has-disabled:opacity-60"
              htmlFor={controlId}
              key={mode}
            >
              <input
                aria-describedby={`${controlId}-description ${controlId}-medal`}
                aria-labelledby={`${controlId}-label`}
                checked={autoHintMode === mode}
                className="accent-mapachito-violet focus-visible:outline-mapachito-violet mt-1 size-5 shrink-0"
                id={controlId}
                name={groupId}
                onChange={() => onAutoHintModeChanged(mode)}
                type="radio"
                value={mode}
              />
              <span className="min-w-0">
                <span
                  className="text-mapachito-charcoal block font-black"
                  id={`${controlId}-label`}
                >
                  {choice.label}
                </span>
                <span
                  className="text-mapachito-charcoal mt-1 block text-sm leading-relaxed"
                  id={`${controlId}-description`}
                >
                  {choice.description}
                </span>
                <span
                  className="text-mapachito-violet mt-2 block text-sm font-bold"
                  id={`${controlId}-medal`}
                >
                  {choice.medal}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

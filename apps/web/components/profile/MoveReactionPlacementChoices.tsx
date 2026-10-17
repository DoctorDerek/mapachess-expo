import { useId } from "react"
import {
  MOVE_REACTION_PLACEMENTS,
  type MoveReactionPlacement,
} from "@mapachess/profile/presentation-preferences"
import { useMapachessCopy } from "./MapachessLocaleProvider"

export default function MoveReactionPlacementChoices({
  placement,
  disabled,
  onChange,
}: Readonly<{
  placement: MoveReactionPlacement
  disabled: boolean
  onChange: (placement: MoveReactionPlacement) => void
}>) {
  const copy = useMapachessCopy().profile.moveReactionPlacement
  const name = useId()
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={`${name}-description`}
      className="mt-7 min-w-0"
    >
      <legend className="text-mapachito-charcoal text-lg font-black">
        {copy.label}
      </legend>
      <p
        id={`${name}-description`}
        className="text-mapachito-charcoal mt-2 text-sm leading-relaxed"
      >
        {copy.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MOVE_REACTION_PLACEMENTS.map((value) => (
          <label
            key={value}
            className="border-mapachito-charcoal/30 text-mapachito-charcoal has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 font-semibold has-focus-visible:outline-3 has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={placement === value}
              onChange={() => onChange(value)}
              className="accent-mapachito-violet size-4 shrink-0"
            />
            {copy.options[value]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

import type { ChallengePositionSetup } from "@mapachess/match/challenge-setup"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

type SetupColor = ChallengePositionSetup["playerColor"]

export default function MatchColorChoices({
  disabled,
  value,
  onChange,
}: Readonly<{
  disabled: boolean
  value: SetupColor
  onChange: (color: SetupColor) => void
}>) {
  const copy = useMapachessCopy().setup
  return (
    <fieldset disabled={disabled}>
      <legend className="font-bold">{copy.color}</legend>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(6rem,100%),1fr))] gap-2">
        {(["white", "black", "random"] as const).map((color) => (
          <label
            className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet flex min-h-12 cursor-pointer items-center justify-center gap-1 rounded-lg border-2 px-1.5 py-2 has-focus-visible:outline-3 has-disabled:opacity-60"
            key={color}
          >
            <input
              className="accent-mapachito-violet size-4 shrink-0"
              checked={value === color}
              name="player-color"
              onChange={() => onChange(color)}
              type="radio"
              value={color}
            />
            <span className="min-w-0 wrap-normal">{copy[color]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

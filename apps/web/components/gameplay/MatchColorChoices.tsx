import { MATCH_SETUP_COPY } from "@mapachess/match/match-setup"

export default function MatchColorChoices({
  disabled,
  initialColor,
}: Readonly<{
  disabled: boolean
  initialColor: "white" | "black" | "random"
}>) {
  return (
    <fieldset disabled={disabled}>
      <legend className="font-bold">{MATCH_SETUP_COPY.color}</legend>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(6rem,100%),1fr))] gap-2">
        {(["white", "black", "random"] as const).map((color) => (
          <label
            className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-2 py-2 has-focus-visible:outline-3 has-disabled:opacity-60"
            key={color}
          >
            <input
              className="accent-mapachito-violet size-4 shrink-0"
              defaultChecked={initialColor === color}
              name="player-color"
              type="radio"
              value={color}
            />
            {MATCH_SETUP_COPY[color]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

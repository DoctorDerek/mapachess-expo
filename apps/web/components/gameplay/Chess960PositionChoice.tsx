import { CHESS960_POSITION_COUNT } from "@mapachess/match/chess960-position"
import { MATCH_SETUP_COPY } from "@mapachess/match/match-setup"
import MapachessButton from "../presentation/MapachessButton"

export default function Chess960PositionChoice({
  disabled,
  numberedPosition,
  onChanged,
  onRandomize,
  value,
}: Readonly<{
  disabled: boolean
  numberedPosition: boolean
  onChanged: (value: string) => void
  onRandomize: () => void
  value: string
}>) {
  return (
    <fieldset disabled={disabled}>
      <legend className="font-bold">{MATCH_SETUP_COPY.position}</legend>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-32" htmlFor="chess960-position">
          <span className="sr-only">
            {MATCH_SETUP_COPY.positionNumber} (0–{CHESS960_POSITION_COUNT - 1})
          </span>
          <input
            className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-violet min-h-12 w-full rounded-lg border-2 px-3 py-2 text-base disabled:opacity-50"
            id="chess960-position"
            inputMode="numeric"
            max={CHESS960_POSITION_COUNT - 1}
            min={0}
            name="chess960-position"
            onChange={(event) => onChanged(event.currentTarget.value)}
            required
            step={1}
            type="number"
            value={value}
          />
        </label>
        <MapachessButton
          disabled={disabled}
          onClick={onRandomize}
          type="button"
          variant="secondary"
        >
          <span aria-hidden="true">⤨ </span>
          {MATCH_SETUP_COPY.randomize}
        </MapachessButton>
      </div>
      <p className="mt-2">
        {numberedPosition
          ? MATCH_SETUP_COPY.pinnedPosition
          : MATCH_SETUP_COPY.freshPosition}
      </p>
    </fieldset>
  )
}

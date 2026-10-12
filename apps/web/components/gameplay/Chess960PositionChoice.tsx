import { useRef, useState } from "react"
import { CHESS960_POSITION_COUNT } from "@mapachess/match/chess960-position"
import { MATCH_SETUP_COPY } from "@mapachess/match/match-setup"
import { isInputDirection } from "@mapachess/match/player-input"
import InputPrompt from "../input/InputPrompt"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
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
  const root = useRef<HTMLFieldSetElement>(null)
  const numberInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<Readonly<{
    value: string
  }> | null>(null)
  usePlayerInputScope({
    root,
    focused: true,
    enabled: !disabled,
    handle: (action, device) => {
      if (
        device.method !== "controller" ||
        document.activeElement !== numberInput.current
      )
        return false
      if (action === "confirm") {
        if (editing === null) setEditing({ value })
        else {
          onChanged(editing.value)
          setEditing(null)
        }
        return true
      }
      if (editing === null) return false
      if (action === "cancel") {
        setEditing(null)
        return true
      }
      if (isInputDirection(action)) {
        const delta = { up: 1, down: -1, left: -10, right: 10 }[action]
        const current = Number(editing.value)
        const next = Math.max(
          0,
          Math.min(
            CHESS960_POSITION_COUNT - 1,
            (Number.isFinite(current) ? current : 0) + delta,
          ),
        )
        setEditing({ ...editing, value: String(next) })
      }
      return true
    },
  })
  return (
    <fieldset
      ref={root}
      disabled={disabled}
      data-player-input-layer={editing === null ? undefined : "position-edit"}
    >
      <legend className="font-bold">{MATCH_SETUP_COPY.position}</legend>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-32" htmlFor="chess960-position">
          <span className="sr-only">
            {MATCH_SETUP_COPY.positionNumber} (0–{CHESS960_POSITION_COUNT - 1})
          </span>
          <input
            ref={numberInput}
            className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-violet min-h-12 w-full rounded-lg border-2 px-3 py-2 text-base disabled:opacity-50"
            id="chess960-position"
            inputMode="numeric"
            max={CHESS960_POSITION_COUNT - 1}
            min={0}
            name="chess960-position"
            onChange={(event) => {
              setEditing(null)
              onChanged(event.currentTarget.value)
            }}
            onBlur={() => setEditing(null)}
            required
            step={1}
            type="number"
            value={editing?.value ?? value}
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
        {editing !== null ? (
          <>
            <InputPrompt action="up" />
            <InputPrompt action="down" /> ±1 · <InputPrompt action="left" />
            <InputPrompt action="right" /> ±10 ·{" "}
            <InputPrompt action="confirm" /> Accept ·{" "}
            <InputPrompt action="cancel" /> Cancel
          </>
        ) : numberedPosition ? (
          MATCH_SETUP_COPY.pinnedPosition
        ) : (
          MATCH_SETUP_COPY.freshPosition
        )}
      </p>
    </fieldset>
  )
}

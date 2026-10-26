import { useRef, useState } from "react"
import { CHESS960_POSITION_COUNT } from "@mapachess/match/chess960-position"
import { isInputDirection } from "@mapachess/match/player-input"
import InputPrompt from "../input/InputPrompt"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

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
  const copy = useMapachessCopy().setup
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
      className="min-w-0"
      ref={root}
      disabled={disabled}
      data-player-input-layer={editing === null ? undefined : "position-edit"}
    >
      <legend className="font-bold">{copy.position}</legend>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-32" htmlFor="chess960-position">
          <span className="sr-only">
            {copy.positionNumber(CHESS960_POSITION_COUNT - 1)}
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
          className="max-w-full min-w-0 px-2! wrap-break-word"
          disabled={disabled}
          onClick={onRandomize}
          type="button"
          variant="secondary"
        >
          <span aria-hidden="true">⤨ </span>
          {copy.randomize}
        </MapachessButton>
      </div>
      <p className="mt-2">
        {editing !== null ? (
          <>
            <InputPrompt action="up" />
            <InputPrompt action="down" /> ±1 · <InputPrompt action="left" />
            <InputPrompt action="right" /> ±10 ·{" "}
            <InputPrompt action="confirm" /> {copy.accept} ·{" "}
            <InputPrompt action="cancel" /> {copy.cancel}
          </>
        ) : numberedPosition ? (
          copy.pinnedPosition
        ) : (
          copy.freshPosition
        )}
      </p>
    </fieldset>
  )
}

import { useRef, useState } from "react"
import { Chess960BoardPreview } from "@mapachess/application-ui/board-grid"
import CHESS_BOARD_PALETTES from "@mapachess/match-presentation/chess-board-palettes"
import { CHESS960_POSITION_COUNT } from "@mapachess/match/chess960-position"
import { type MatchColor } from "@mapachess/match/match-position"
import { isInputDirection } from "@mapachess/match/player-input"
import { useDisplayedChessAppearance } from "@/components/gameplay/ChessArtwork"
import webBoardElements from "@/components/gameplay/WebBoardElements"
import InputPrompt from "@/components/input/InputPrompt"
import { usePlayerInputScope } from "@/components/input/PlayerInputProvider"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"

export function PositionNumberInput({
  disabled,
  onChanged,
  value,
}: Readonly<{
  disabled: boolean
  onChanged: (value: string) => void
  orientation: MatchColor
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
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label
          className="relative min-w-0 flex-1 basis-32"
          htmlFor="chess960-position"
        >
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
      </div>
      {editing === null ? null : (
        <p className="mt-2">
          <InputPrompt action="up" />
          <InputPrompt action="down" /> ±1 · <InputPrompt action="left" />
          <InputPrompt action="right" /> ±10 · <InputPrompt action="confirm" />{" "}
          {copy.accept} · <InputPrompt action="cancel" /> {copy.cancel}
        </p>
      )}
    </fieldset>
  )
}

export function PositionPreview({
  value,
  orientation,
}: Readonly<{ value: string; orientation: MatchColor }>) {
  const appearance = useDisplayedChessAppearance()
  return (
    <Chess960BoardPreview
      value={value}
      orientation={orientation}
      copy={useMapachessCopy()}
      palette={CHESS_BOARD_PALETTES[appearance.boardId]}
      elements={webBoardElements}
    />
  )
}

export default PositionNumberInput

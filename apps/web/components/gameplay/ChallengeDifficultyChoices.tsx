import { useId, useRef, type RefObject } from "react"
import type {
  ChallengeDifficultyControlState,
  ChallengeDifficultyEdit,
} from "@mapachess/gameplay/challenge-difficulty"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function ChallengeDifficultyChoices({
  control,
  disabled,
  exactInput,
  onEdit,
}: Readonly<{
  control: ChallengeDifficultyControlState
  disabled: boolean
  exactInput: RefObject<HTMLInputElement | null>
  onEdit: (edit: ChallengeDifficultyEdit) => void
}>) {
  const catalog = useMapachessCopy()
  const copy = catalog.setup
  const inputId = useId()
  const errorId = useId()
  const range = useRef<HTMLInputElement>(null)
  const { grid, rangeValue, exactText, hasPendingText, showError, history } =
    control
  const { minimum, maximum, step } = grid
  const record = history.type === "played" ? history.record : null
  const selectElo = (targetElo: number): void =>
    onEdit({ type: "selected", targetElo })
  const confirmElo = (input: HTMLInputElement): void => {
    if (!disabled && hasPendingText) selectElo(input.valueAsNumber)
  }

  usePlayerInputScope({
    root: range,
    focused: true,
    enabled: !disabled,
    handle: (action, device) => {
      if (
        device.method !== "controller" ||
        document.activeElement !== range.current ||
        (action !== "left" && action !== "right")
      )
        return false
      onEdit({ type: "stepped", direction: action === "left" ? -1 : 1 })
      return true
    },
  })

  return (
    <fieldset className="grid min-w-0 gap-1" disabled={disabled}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="font-bold" htmlFor={inputId}>
          {copy.opponentElo}
        </label>
        <input
          aria-describedby={showError ? errorId : undefined}
          aria-invalid={showError || undefined}
          autoComplete="off"
          className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-violet aria-invalid:border-mapachito-raspberry min-h-12 w-24 max-w-full min-w-0 rounded-lg border-2 px-2 text-center text-lg font-bold tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60"
          id={inputId}
          inputMode="numeric"
          onBlur={() => onEdit({ type: "committed" })}
          onChange={(event) =>
            onEdit({ type: "typed", text: event.currentTarget.value })
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            onEdit({ type: "committed" })
          }}
          ref={exactInput}
          spellCheck={false}
          type="text"
          value={exactText}
        />
      </div>
      <input
        aria-label={copy.adjustOpponentElo}
        aria-valuetext={copy.elo(String(rangeValue))}
        className="accent-mapachito-violet focus-visible:outline-mapachito-violet min-h-12 w-full min-w-0 cursor-pointer rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60"
        max={maximum}
        min={minimum}
        onChange={(event) => selectElo(event.currentTarget.valueAsNumber)}
        onClick={(event) => confirmElo(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key !== "Home" && event.key !== "End") return
          event.preventDefault()
          selectElo(event.key === "Home" ? minimum : maximum)
        }}
        onPointerUp={(event) => {
          if (event.pointerType === "touch" && event.isPrimary)
            confirmElo(event.currentTarget)
        }}
        ref={range}
        step={step}
        type="range"
        value={rangeValue}
      />
      <div
        aria-hidden="true"
        className="flex justify-between gap-2 text-sm font-semibold tabular-nums"
      >
        <span>{minimum}</span>
        <span>{maximum}</span>
      </div>
      {showError ? (
        <p
          className="text-mapachito-charcoal text-sm font-bold"
          id={errorId}
          role="alert"
        >
          {copy.invalidOpponentElo(minimum, maximum, step)}
        </p>
      ) : null}
      {record !== null ? (
        <dl className="flex flex-wrap items-start gap-x-5 gap-y-1 pt-1">
          {record.highestMedal === null ? null : (
            <div className="min-w-0">
              <dt className="text-sm font-semibold">
                {copy.bestDifficultyMedal}
              </dt>
              <dd className="font-bold">
                <MedalSymbol medal={record.highestMedal} />
                {catalog.shared.story.medals[record.highestMedal]}
              </dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-sm font-semibold">
              {copy.lastDifficultyOpponent}
            </dt>
            <dd className="font-bold">
              {catalog.animals.opponent(record.lastPlayedAnimal)}
            </dd>
          </div>
        </dl>
      ) : history.type === "unplayed" ? (
        <p className="pt-1 text-sm">{copy.noDifficultyHistory}</p>
      ) : null}
    </fieldset>
  )
}

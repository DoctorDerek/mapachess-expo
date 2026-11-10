import { useId, useRef, type RefObject } from "react"
import {
  challengeDifficultyHistory,
  challengeDifficultyText,
  type ChallengeDifficultyDraft,
  type ChallengeDifficultyEdit,
  type ChallengeDifficultyGrid,
} from "@mapachess/gameplay/challenge-difficulty"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function ChallengeDifficultyChoices({
  disabled,
  draft,
  exactInput,
  grid,
  history,
  onEdit,
  variant,
}: Readonly<{
  disabled: boolean
  draft: ChallengeDifficultyDraft
  exactInput: RefObject<HTMLInputElement | null>
  grid: ChallengeDifficultyGrid
  history: MapachessPlayerData["challengeHistory"]
  onEdit: (edit: ChallengeDifficultyEdit) => void
  variant: MatchVariant
}>) {
  const catalog = useMapachessCopy()
  const copy = catalog.setup
  const inputId = useId()
  const errorId = useId()
  const range = useRef<HTMLInputElement>(null)
  const { minimum, maximum, step } = grid
  const record = challengeDifficultyHistory(history, variant, draft.selectedElo)
  const target = draft.selectedElo ?? minimum
  const selectElo = (targetElo: number): void =>
    onEdit({ type: "selected", targetElo })

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
          aria-describedby={draft.showError ? errorId : undefined}
          aria-invalid={draft.showError || undefined}
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
          value={challengeDifficultyText(draft)}
        />
      </div>
      <input
        aria-label={copy.adjustOpponentElo}
        aria-valuetext={copy.elo(String(target))}
        className="accent-mapachito-violet focus-visible:outline-mapachito-violet min-h-12 w-full min-w-0 cursor-pointer rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60"
        max={maximum}
        min={minimum}
        onChange={(event) => selectElo(event.currentTarget.valueAsNumber)}
        onClick={(event) => {
          if (draft.exactText !== null)
            selectElo(event.currentTarget.valueAsNumber)
        }}
        onKeyDown={(event) => {
          if (event.key !== "Home" && event.key !== "End") return
          event.preventDefault()
          selectElo(event.key === "Home" ? minimum : maximum)
        }}
        ref={range}
        step={step}
        type="range"
        value={target}
      />
      <div
        aria-hidden="true"
        className="flex justify-between gap-2 text-sm font-semibold tabular-nums"
      >
        <span>{minimum}</span>
        <span>{maximum}</span>
      </div>
      {draft.showError ? (
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
      ) : draft.selectedElo === null ? null : (
        <p className="pt-1 text-sm">{copy.noDifficultyHistory}</p>
      )}
    </fieldset>
  )
}

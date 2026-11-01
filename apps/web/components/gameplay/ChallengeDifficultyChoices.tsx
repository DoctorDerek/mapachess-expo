import cx from "classix"
import { useId, useRef, useState } from "react"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"

const ELO_RANGE_WIDTH = 250
const rangeStart = (target: number): number =>
  Math.floor(target / ELO_RANGE_WIDTH) * ELO_RANGE_WIDTH

export default function ChallengeDifficultyChoices({
  disabled,
  history,
  onSelected,
  selectedElo,
  targets,
}: Readonly<{
  disabled: boolean
  history: MapachessPlayerData["challengeHistory"]["standard"]
  onSelected: (target: number) => void
  selectedElo: number | undefined
  targets: readonly number[]
}>) {
  const catalog = useMapachessCopy()
  const medals = catalog.shared.story.medals
  const animalCopy = catalog.animals
  const messages = catalog.interface.challengeDifficultyChoices
  const copy = catalog.setup
  const explanationId = useId()
  const [hoveredTarget, setHoveredTarget] = useState<number | null>(null)
  const [focusedTarget, setFocusedTarget] = useState<number | null>(null)

  const [viewedRange, setViewedRange] = useState(() =>
    rangeStart(selectedElo ?? targets[0] ?? 0),
  )
  const groups = new Map<number, number[]>()
  for (const target of targets) {
    const start = rangeStart(target)
    const group = groups.get(start)
    if (group === undefined) groups.set(start, [target])
    else group.push(target)
  }
  const showRanges = targets.length > 10
  const visibleTargets = showRanges ? (groups.get(viewedRange) ?? []) : targets
  const rangeControl = useRef<HTMLSelectElement>(null)
  usePlayerInputScope({
    root: rangeControl,
    focused: true,
    enabled: showRanges && !disabled,
    handle: (action, device) => {
      const select = rangeControl.current
      if (device.method !== "controller" || select === null) return false
      if (action === "left" || action === "right") {
        const adjacent =
          select.options[select.selectedIndex + (action === "left" ? -1 : 1)]
        if (adjacent !== undefined) setViewedRange(Number(adjacent.value))
        return true
      }
      if (action !== "confirm") return false
      const group = select.closest("fieldset")
      const tile =
        group?.querySelector<HTMLInputElement>("input:checked") ??
        group?.querySelector<HTMLInputElement>("input")
      tile?.focus()
      return true
    },
  })

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className={showRanges ? "sr-only" : "text-lg font-black"}>
        {copy.difficulty}
      </legend>
      {showRanges ? (
        <label className="flex flex-wrap items-center gap-2 font-bold">
          {messages.range}
          <select
            className="border-mapachito-charcoal/60 bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-violet min-h-12 max-w-full rounded-lg border-2 px-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2"
            ref={rangeControl}
            value={viewedRange}
            onKeyDown={(event) => {
              if (event.key !== "Escape" && event.key !== "Tab")
                event.stopPropagation()
            }}
            onChange={(event) =>
              setViewedRange(Number(event.currentTarget.value))
            }
          >
            {Array.from(groups, ([start, values]) => (
              <option key={start} value={start}>
                {values[0]}–{values.at(-1)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(7rem,100%),1fr))] gap-3">
        {visibleTargets.map((target) => {
          const record = history.difficulties.find(
            ({ targetElo }) => targetElo === target,
          )
          const medal = record?.highestMedal ?? null
          const animal =
            record === undefined
              ? null
              : stockfishOpponent(record.lastPlayedAnimal)
          return (
            <label
              key={target}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") setHoveredTarget(target)
              }}
              onPointerLeave={() => setHoveredTarget(null)}
              className={cx(
                "group border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet relative grid min-h-14 cursor-pointer gap-2 rounded-lg border-2 p-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-disabled:cursor-default has-disabled:opacity-60",
                animal === null ? "content-center" : "grid-rows-[auto_6.5rem]",
              )}
            >
              <input
                aria-describedby={explanationId}
                className="sr-only"
                type="radio"
                name="challenge-difficulty"
                value={target}
                checked={selectedElo === target}
                onChange={() => onSelected(target)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible"))
                    setFocusedTarget(target)
                }}
                onBlur={() => setFocusedTarget(null)}
              />
              <span className="flex w-full items-center justify-between gap-1">
                <span className="font-display text-2xl font-black">
                  {target}
                  <span className="sr-only"> {messages.elo}</span>
                </span>
                {medal === null ? null : (
                  <span>
                    <MedalSymbol medal={medal} />
                    <span className="sr-only">
                      {" "}
                      {copy.bestMedal(medals[medal])}
                    </span>
                  </span>
                )}
              </span>
              {animal === null ? null : (
                <span className="h-full w-full justify-self-center">
                  <ChallengeAnimalPortrait
                    key={animal.id}
                    opponent={animal}
                    active
                    attention={
                      !disabled &&
                      (hoveredTarget === target || focusedTarget === target)
                    }
                  />
                  <span className="sr-only">
                    {" "}
                    {copy.lastPlayed(animalCopy.opponent(animal.id))}
                  </span>
                </span>
              )}
            </label>
          )
        })}
      </div>
      <p id={explanationId} className="mt-3 text-base leading-relaxed">
        {copy.difficultyMedals}
      </p>
    </fieldset>
  )
}

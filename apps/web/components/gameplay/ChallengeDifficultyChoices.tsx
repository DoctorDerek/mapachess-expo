import { useId, useState } from "react"
import { MATCH_SETUP_COPY } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { STORY_PROGRESS_COPY } from "@mapachess/profile/story-progress"
import MedalSymbol from "../presentation/MedalSymbol"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"

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
  const explanationId = useId()
  const [expanded, setExpanded] = useState(true)
  const [hoveredTarget, setHoveredTarget] = useState<number | null>(null)
  const [focusedTarget, setFocusedTarget] = useState<number | null>(null)

  return (
    <fieldset className="mt-6" disabled={disabled}>
      <legend className="text-lg font-black">
        {MATCH_SETUP_COPY.difficulty}
      </legend>
      <details
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary className="focus-visible:outline-mapachito-violet mt-3 min-h-12 cursor-pointer rounded-lg border-2 px-4 py-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2">
          {selectedElo === undefined
            ? "Choose difficulty"
            : `${selectedElo} Elo`}{" "}
          · Change difficulty
        </summary>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3">
          {targets.map((target) => {
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
                className="group border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet relative grid cursor-pointer grid-rows-[auto_6.5rem] gap-2 rounded-lg border-2 p-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-disabled:cursor-default has-disabled:opacity-60"
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
                    <span className="sr-only"> Elo</span>
                  </span>
                  {medal === null ? null : (
                    <span>
                      <MedalSymbol medal={medal} />
                      <span className="sr-only">
                        {" "}
                        · Best medal: {STORY_PROGRESS_COPY.medals[medal]}
                      </span>
                    </span>
                  )}
                </span>
                {animal === null ? (
                  <span aria-hidden="true" />
                ) : (
                  <span className="h-full w-full justify-self-center">
                    <ChallengeAnimalPortrait
                      key={animal.id}
                      opponent={animal}
                      active={expanded}
                      attention={
                        !disabled &&
                        (hoveredTarget === target || focusedTarget === target)
                      }
                    />
                    <span className="sr-only">
                      {" "}
                      · Last played: {animal.displayName}
                    </span>
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </details>
      <p id={explanationId} className="mt-3 text-sm leading-relaxed">
        Best medal at this difficulty: Gold — no hints; Silver — Piece Hints
        only; Bronze — Move Hints allowed. The animal is your last played
        opponent, not your next selection.
      </p>
    </fieldset>
  )
}

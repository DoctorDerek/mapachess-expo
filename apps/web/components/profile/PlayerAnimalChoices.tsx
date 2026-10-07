import cx from "classix"
import { useId, useState } from "react"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  DEFAULT_PLAYER_APPEARANCE,
  eligiblePlayerAnimals,
} from "@mapachess/profile/player-appearance"
import type { StoryProgress } from "@mapachess/profile/story-progress"
import ChallengeAnimalPortrait from "../gameplay/ChallengeAnimalPortrait"

const PLAYER_ANIMALS = Object.freeze([
  stockfishOpponent(DEFAULT_PLAYER_APPEARANCE.animal),
  ...STOCKFISH_OPPONENTS.filter(
    ({ id }) => id !== DEFAULT_PLAYER_APPEARANCE.animal,
  ),
])

export default function PlayerAnimalChoices({
  active = true,
  disabled,
  onSelected,
  selectedId,
  storyProgress,
}: Readonly<{
  active?: boolean
  disabled: boolean
  onSelected: (animal: StockfishOpponentId) => void
  selectedId: StockfishOpponentId
  storyProgress: StoryProgress
}>) {
  const groupId = useId()
  const [attentionId, setAttentionId] = useState<StockfishOpponentId | null>(
    null,
  )
  const unlocked = eligiblePlayerAnimals(storyProgress)

  return (
    <fieldset
      aria-describedby={`${groupId}-help`}
      className="text-mapachito-white min-w-0"
      disabled={disabled}
    >
      <legend className="font-display text-xl font-bold">Play as</legend>
      <p className="mt-1 text-base" id={`${groupId}-help`}>
        Beat animals in Story to unlock them. Raccoon is always yours.
      </p>
      <div
        aria-label="Player animals"
        className="mt-2 grid max-h-96 [scrollbar-color:var(--color-mapachito-blue)_var(--color-mapachito-charcoal)] [scrollbar-gutter:stable] grid-cols-[repeat(auto-fit,minmax(min(7.5rem,100%),1fr))] gap-3 overflow-x-hidden overflow-y-scroll overscroll-contain p-2"
        role="region"
        tabIndex={0}
      >
        {PLAYER_ANIMALS.map((opponent) => {
          const selected = selectedId === opponent.id
          const locked = !selected && !unlocked.includes(opponent.id)
          const attention = !disabled && !locked && attentionId === opponent.id

          return (
            <label
              className={cx(
                "relative grid min-w-0 grid-rows-[6.5rem_auto] gap-2 rounded-[0.75rem_0.25rem_0.75rem_0.25rem] p-2 text-center has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-white",
                locked
                  ? "cursor-not-allowed"
                  : "cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-60",
                selected
                  ? "bg-mapachito-violet ring-2 ring-white"
                  : locked
                    ? "bg-white/10"
                    : "bg-mapachito-blue",
              )}
              key={opponent.id}
              onPointerEnter={(event) => {
                if (!disabled && !locked && event.pointerType !== "touch")
                  setAttentionId(opponent.id)
              }}
              onPointerLeave={() => setAttentionId(null)}
            >
              <input
                checked={selected}
                className="absolute inset-0 z-1 m-0 size-full cursor-[inherit] opacity-0"
                disabled={locked}
                name={groupId}
                onBlur={() => setAttentionId(null)}
                onChange={() => onSelected(opponent.id)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible"))
                    setAttentionId(opponent.id)
                }}
                type="radio"
                value={opponent.id}
              />
              <span
                className={cx(
                  "pointer-events-none block min-w-0",
                  locked && "grayscale",
                )}
              >
                <ChallengeAnimalPortrait
                  active={active && !disabled && (selected || attention)}
                  attention={attention}
                  opponent={opponent}
                />
              </span>
              <span className="text-xl leading-snug font-bold">
                {opponent.displayName.replace(" Stockfish", "")}
                {locked ? (
                  <span className="block text-base font-normal">Locked</span>
                ) : null}
              </span>
              {selected ? (
                <span className="bg-mapachito-violet absolute top-1 right-1 rounded-full px-1.5 text-lg leading-tight font-bold">
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">Selected</span>
                </span>
              ) : null}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

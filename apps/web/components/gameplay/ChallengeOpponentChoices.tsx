import { useState } from "react"
import {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentDefinition,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"
import StoryOpponentPortrait from "./StoryOpponentPortrait"

export default function ChallengeOpponentChoices({
  disabled,
  onSelected,
  unlockedOpponents,
  selectedId,
}: Readonly<{
  disabled: boolean
  onSelected: (id: StockfishOpponentId) => void
  unlockedOpponents: readonly StockfishOpponentDefinition[]
  selectedId: StockfishOpponentId
}>) {
  const copy = useMapachessCopy()
  const [attentionId, setAttentionId] = useState<StockfishOpponentId | null>(
    null,
  )
  const unlockedIds = new Set(unlockedOpponents.map(({ id }) => id))
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">{copy.setup.chooseAnimal}</legend>
      {unlockedIds.size < STOCKFISH_OPPONENTS.length ? (
        <p className="mb-3 text-base">{copy.setup.challengeAvailability}</p>
      ) : null}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(5.25rem,100%),1fr))] gap-2 xl:grid-cols-6">
        {STOCKFISH_OPPONENTS.map((opponent) => {
          const unlocked = unlockedIds.has(opponent.id)
          const Tile = unlocked ? "label" : "div"
          return (
            <li key={opponent.id}>
              <Tile
                className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet relative grid h-full grid-rows-[3.25rem_auto] gap-1 rounded-lg border-2 px-1.5 py-2 text-center has-focus-visible:outline-3 has-[input]:cursor-pointer"
                onPointerEnter={
                  unlocked
                    ? (event) => {
                        if (!disabled && event.pointerType !== "touch")
                          setAttentionId(opponent.id)
                      }
                    : undefined
                }
                onPointerLeave={
                  unlocked ? () => setAttentionId(null) : undefined
                }
              >
                {unlocked ? (
                  <>
                    <input
                      aria-label={copy.animals.opponent(opponent.id)}
                      checked={selectedId === opponent.id}
                      className="sr-only"
                      name="challenge-opponent"
                      onBlur={() => setAttentionId(null)}
                      onChange={() => onSelected(opponent.id)}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible"))
                          setAttentionId(opponent.id)
                      }}
                      type="radio"
                      value={opponent.id}
                    />
                    <ChallengeAnimalPortrait
                      active
                      attention={!disabled && attentionId === opponent.id}
                      opponent={opponent}
                    />
                  </>
                ) : (
                  <StoryOpponentPortrait
                    opponent={opponent}
                    locked
                    framed={false}
                  />
                )}
                <span className="self-end text-sm leading-tight font-bold">
                  {copy.animals.names[opponent.id]}
                  {unlocked ? null : (
                    <span className="sr-only">
                      {" "}
                      · {copy.shared.story.locked}
                    </span>
                  )}
                </span>
                {!unlocked || selectedId === opponent.id ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1.5 text-xs font-black"
                  >
                    {unlocked ? "✓" : "🔒"}
                  </span>
                ) : null}
              </Tile>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

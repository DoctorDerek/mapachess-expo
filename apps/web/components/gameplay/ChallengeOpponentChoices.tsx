import { useState } from "react"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"

export default function ChallengeOpponentChoices({
  disabled,
  onSelected,
  opponents,
  selectedId,
}: Readonly<{
  disabled: boolean
  onSelected: (id: StockfishOpponentDefinition["id"]) => void
  opponents: readonly StockfishOpponentDefinition[]
  selectedId: StockfishOpponentDefinition["id"]
}>) {
  const [attentionId, setAttentionId] = useState<string | null>(null)
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">Choose animal</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
        {opponents.map((opponent) => (
          <label
            className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet grid cursor-pointer grid-rows-[6.5rem_auto] gap-2 rounded-lg border-2 p-3 has-focus-visible:outline-3 has-disabled:opacity-60"
            key={opponent.id}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") setAttentionId(opponent.id)
            }}
            onPointerLeave={() => setAttentionId(null)}
          >
            <input
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
            <span className="text-center font-bold">
              {opponent.displayName}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

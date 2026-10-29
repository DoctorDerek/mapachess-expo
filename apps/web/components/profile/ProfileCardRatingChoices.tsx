import { TIME_CATEGORIES } from "@mapachess/match/time-control"
import { MATCH_MEDALS } from "@mapachess/profile/match-medal"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import { useMapachessCopy } from "./MapachessLocaleProvider"

export default function ProfileCardRatingChoices({
  ratingContext,
  onChange,
  disabled,
}: Readonly<{
  ratingContext: CardRatingContext
  onChange: (context: CardRatingContext) => void
  disabled: boolean
}>) {
  const copy = useMapachessCopy()
  return (
    <fieldset className="mt-4 flex min-w-0 flex-wrap gap-3">
      <legend className="mb-2 font-bold">{copy.profile.cardRatings}</legend>
      <label className="flex min-w-0 flex-1 basis-32 flex-col justify-between gap-2">
        {copy.profile.cardTimeCategory}
        <select
          value={ratingContext.category}
          disabled={disabled}
          onChange={(event) => {
            const category = TIME_CATEGORIES.find(
              (value) => value === event.target.value,
            )
            if (category !== undefined) onChange({ ...ratingContext, category })
          }}
          className="bg-mapachito-surface min-h-12 w-full rounded-lg p-3 font-bold"
        >
          {TIME_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {copy.gameplay.clock.category[category]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 basis-32 flex-col justify-between gap-2">
        {copy.profile.cardAssistance}
        <select
          value={ratingContext.assistance}
          disabled={disabled}
          onChange={(event) => {
            const assistance = MATCH_MEDALS.find(
              (value) => value === event.target.value,
            )
            if (assistance !== undefined)
              onChange({ ...ratingContext, assistance })
          }}
          className="bg-mapachito-surface min-h-12 w-full rounded-lg p-3 font-bold"
        >
          {MATCH_MEDALS.map((assistance) => (
            <option key={assistance} value={assistance}>
              {copy.shared.story.medals[assistance]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

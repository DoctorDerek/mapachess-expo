import { TIME_CATEGORIES } from "@mapachess/match/time-control"
import { MATCH_MEDALS } from "@mapachess/profile/match-medal"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import ProfileCard from "./ProfileCard"

export default function ProfileCardRatingChoices({
  data,
  draft,
  ratingContext,
  onChange,
  disabled,
}: Readonly<{
  data: MapachessPlayerData
  draft: PlayerAppearance
  ratingContext: CardRatingContext
  onChange: (context: CardRatingContext) => void
  disabled: boolean
}>) {
  const copy = useMapachessCopy()
  return (
    <details className="mt-4 min-w-0">
      <summary className="min-h-12 cursor-pointer content-center text-lg font-bold focus-visible:outline-2">
        {copy.profile.cardRatings}
      </summary>
      <fieldset className="mt-3 flex min-w-0 flex-wrap gap-4">
        <legend className="sr-only">{copy.profile.cardRatings}</legend>
        <label className="flex min-w-0 flex-col gap-2">
          {copy.profile.cardTimeCategory}
          <select
            value={ratingContext.category}
            disabled={disabled}
            onChange={(event) => {
              const category = TIME_CATEGORIES.find(
                (value) => value === event.target.value,
              )
              if (category !== undefined)
                onChange({ ...ratingContext, category })
            }}
            className="bg-mapachito-surface min-h-12 rounded-lg p-3 font-bold"
          >
            {TIME_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {copy.gameplay.clock.category[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2">
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
            className="bg-mapachito-surface min-h-12 rounded-lg p-3 font-bold"
          >
            {MATCH_MEDALS.map((assistance) => (
              <option key={assistance} value={assistance}>
                {copy.shared.story.medals[assistance]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className="mt-4">
        <ProfileCard
          data={data}
          appearance={draft}
          ratingContext={ratingContext}
        />
      </div>
    </details>
  )
}

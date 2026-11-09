import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { levelFromTotalXp } from "@mapachess/profile/global-xp"
import matchVictoryMedal from "@mapachess/profile/match-medal"
import { matchResultRating } from "@mapachess/profile/match-result-presentation"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import MedalWithHintUse from "./MedalWithHintUse"

export default function MatchResultFacts({
  match,
  reward,
}: Readonly<{
  match: DurableMatchRecord
  reward: AcceptedMatchReward | null
}>) {
  const copy = useMapachessCopy()

  const challengeMedal =
    match.mode === "challenge" ? matchVictoryMedal(match) : null
  if (challengeMedal === null && reward === null) return null
  const rating = matchResultRating(match, reward)

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold">
      {challengeMedal === null ? null : (
        <MedalWithHintUse medal={challengeMedal} />
      )}
      {reward === null ? null : (
        <>
          <span>{copy.gameplay.awardedXp(reward.awardedXp)}</span>
          <span>
            {copy.gameplay.level(
              levelFromTotalXp(reward.totalXpBefore + reward.awardedXp),
            )}
          </span>
          {rating === null ? null : (
            <span>
              <MedalSymbol medal={rating.assistance} />
              {copy.profile.rating(
                copy.gameplay.clock.rating(
                  copy.setup.variants[rating.variant],
                  copy.gameplay.clock.category[rating.timeCategory],
                  copy.shared.story.medals[rating.assistance],
                ),
                rating.after,
              )}
            </span>
          )}
        </>
      )}
    </p>
  )
}

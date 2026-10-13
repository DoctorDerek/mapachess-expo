import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { levelFromTotalXp } from "@mapachess/profile/global-xp"
import matchVictoryMedal from "@mapachess/profile/match-medal"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
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
          {reward.ratedElo === null ? null : (
            <span>
              {copy.profile.rating(
                copy.setup.variants[reward.ratedElo.variant],
                reward.ratedElo.after,
              )}
            </span>
          )}
        </>
      )}
    </p>
  )
}

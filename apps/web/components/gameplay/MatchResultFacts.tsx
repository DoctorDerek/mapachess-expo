import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { levelFromTotalXp } from "@mapachess/profile/global-xp"
import matchVictoryMedal from "@mapachess/profile/match-medal"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
import { STORY_PROGRESS_COPY } from "@mapachess/profile/story-progress"
import MedalSymbol from "../presentation/MedalSymbol"

export default function MatchResultFacts({
  match,
  reward,
}: Readonly<{
  match: DurableMatchRecord
  reward: AcceptedMatchReward | null
}>) {
  const challengeMedal =
    match.mode === "challenge" ? matchVictoryMedal(match) : null
  if (challengeMedal === null && reward === null) return null

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold">
      {challengeMedal === null ? null : (
        <span>
          <MedalSymbol medal={challengeMedal} />
          {STORY_PROGRESS_COPY.medals[challengeMedal]}
        </span>
      )}
      {reward === null ? null : (
        <>
          <span>+{reward.awardedXp} XP</span>
          <span>
            Level {levelFromTotalXp(reward.totalXpBefore + reward.awardedXp)}
          </span>
          {reward.ratedElo === null ? null : (
            <span>
              {reward.ratedElo.variant === "standard" ? "Standard" : "Chess960"}{" "}
              Elo {Math.round(reward.ratedElo.after)}
            </span>
          )}
        </>
      )}
    </p>
  )
}

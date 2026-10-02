import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { adjustChallengeResultCount } from "./challengeHistory.js"
import {
  completedMatchXpAward,
  LEVEL_ACHIEVEMENTS,
  levelAchievementsCrossed,
} from "./globalXp.js"
import {
  acceptedRewardMatchesEnding,
  type AcceptedMatchReward,
  type MapachessPlayerData,
} from "./playerData.js"
import { playerResultScore, updatedPlayerElo } from "./playerElo.js"

type ResultBalances = Pick<
  MapachessPlayerData,
  | "totalXp"
  | "ratings"
  | "ratedMatchCounts"
  | "challengeHistory"
  | "lastAcceptedResultReward"
  | "unlockedAchievementIds"
  | "processedMatchResultIds"
>

const retractResult = (
  current: MapachessPlayerData,
  reward: AcceptedMatchReward,
): ResultBalances => {
  const contribution = reward.contribution
  if (contribution === undefined || !contribution.applied) return current
  const rated = contribution.eloState === "active" ? reward.ratedElo : null
  if (
    current.totalXp !== reward.totalXpBefore + reward.awardedXp ||
    (rated !== null &&
      (contribution.ratedMatchCountBefore === null ||
        current.ratings[rated.variant] !== rated.after ||
        current.ratedMatchCounts[rated.variant] !==
          contribution.ratedMatchCountBefore + 1))
  )
    throw new Error(
      "Active result balances do not match their accepted receipt.",
    )
  return {
    ...current,
    totalXp: reward.totalXpBefore,
    ratings:
      rated === null
        ? current.ratings
        : Object.freeze({ ...current.ratings, [rated.variant]: rated.before }),
    ratedMatchCounts:
      rated === null
        ? current.ratedMatchCounts
        : Object.freeze({
            ...current.ratedMatchCounts,
            [rated.variant]: contribution.ratedMatchCountBefore,
          }),
    challengeHistory:
      contribution.challengeOutcome === null
        ? current.challengeHistory
        : adjustChallengeResultCount(
            current.challengeHistory,
            contribution.variant,
            contribution.opponentId,
            contribution.challengeOutcome,
            -1,
          ),
    lastAcceptedResultReward: Object.freeze({
      ...reward,
      contribution: Object.freeze({ ...contribution, applied: false }),
    }),
  }
}

export default function accountActiveResult(
  current: MapachessPlayerData,
  match: DurableMatchRecord | null,
): ResultBalances {
  if (match === null) return current
  const reward = current.lastAcceptedResultReward
  const sameReceipt = reward?.matchId === match.matchId ? reward : null
  if (sameReceipt !== null && acceptedRewardMatchesEnding(sameReceipt, match))
    return current
  const balances =
    sameReceipt?.contribution === undefined
      ? current
      : retractResult(current, sameReceipt)
  if (match.conclusion === null)
    return sameReceipt !== null && sameReceipt.contribution === undefined
      ? { ...balances, lastAcceptedResultReward: null }
      : balances
  const previouslyProcessed = current.processedMatchResultIds.includes(
    match.matchId,
  )
  if (previouslyProcessed && sameReceipt?.contribution === undefined)
    return balances

  const variant = match.startingPosition.variant
  const eloState =
    sameReceipt?.contribution?.eloState === "superseded"
      ? "superseded"
      : "active"
  const rated =
    eloState !== "superseded" &&
    typeof match.ratedOpponentElo === "number" &&
    current.activeMatch?.matchId === match.matchId &&
    current.activeMatch.ratedOpponentElo === match.ratedOpponentElo
      ? Object.freeze({
          variant,
          before: balances.ratings[variant],
          after: updatedPlayerElo(
            balances.ratings[variant],
            balances.ratedMatchCounts[variant],
            match.ratedOpponentElo,
            playerResultScore(match.conclusion, match.playerColor),
          ),
        })
      : null
  const awardedXp = completedMatchXpAward(match)
  const totalXp = balances.totalXp + awardedXp
  if (!Number.isSafeInteger(totalXp))
    throw new RangeError("Global XP exceeds the supported save range.")
  const unlocked = levelAchievementsCrossed(balances.totalXp, totalXp).filter(
    (id) => !current.unlockedAchievementIds.includes(id),
  )
  const challengeOutcome =
    match.mode === "challenge" && "winner" in match.conclusion
      ? match.conclusion.winner === match.playerColor
        ? "win"
        : "loss"
      : null
  const nextReward: AcceptedMatchReward = Object.freeze({
    matchId: match.matchId,
    awardedXp,
    totalXpBefore: balances.totalXp,
    unlockedAchievementIds: Object.freeze(unlocked),
    ratedElo: rated,
    contribution: Object.freeze({
      applied: true,
      eloState,
      variant,
      opponentId: match.opponentId,
      challengeOutcome,
      ratedMatchCountBefore:
        rated === null ? null : balances.ratedMatchCounts[variant],
      ending: Object.freeze({
        conclusion: match.conclusion,
        cursor: match.cursor,
        currentFen: match.currentFen,
        moveIds: Object.freeze(match.moveIds.slice(0, match.cursor)),
      }),
    }),
  })
  return {
    ...balances,
    totalXp,
    lastAcceptedResultReward: nextReward,
    ratings:
      rated === null
        ? balances.ratings
        : Object.freeze({ ...balances.ratings, [variant]: rated.after }),
    ratedMatchCounts:
      rated === null
        ? balances.ratedMatchCounts
        : Object.freeze({
            ...balances.ratedMatchCounts,
            [variant]: balances.ratedMatchCounts[variant] + 1,
          }),
    challengeHistory:
      challengeOutcome === null
        ? balances.challengeHistory
        : adjustChallengeResultCount(
            balances.challengeHistory,
            variant,
            match.opponentId,
            challengeOutcome,
            1,
          ),
    unlockedAchievementIds: Object.freeze(
      LEVEL_ACHIEVEMENTS.filter(
        ({ id }) =>
          current.unlockedAchievementIds.includes(id) || unlocked.includes(id),
      ).map(({ id }) => id),
    ),
    processedMatchResultIds: previouslyProcessed
      ? current.processedMatchResultIds
      : Object.freeze([...current.processedMatchResultIds, match.matchId]),
  }
}

import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import applyChallengeMatchResult, {
  recordChallengeStart,
} from "./challengeHistory.js"
import type { DurablePlayerDataSlot } from "./durableStore.js"
import { requiredRecoveryRevision } from "./durableStore.js"
import { completedMatchXpAward, levelAchievementsCrossed } from "./globalXp.js"
import createInitialMapachessPlayerData, {
  INITIAL_PLAYER_ELO,
  type MapachessPlayerData,
  type PlayerEloRatingId,
} from "./playerData.js"
import { playerResultScore, updatedPlayerElo } from "./playerElo.js"
import applyStoryMatchResult from "./storyProgress.js"

const freezePlayerData = (
  data: MapachessPlayerData,
  revision: number,
): MapachessPlayerData =>
  Object.freeze({
    ...data,
    revision,
  })

export const changeAutoHintMode = (
  current: MapachessPlayerData,
  autoHintMode: AutoHintMode,
): MapachessPlayerData =>
  Object.freeze({
    ...current,
    revision: current.revision + 1,
    settings: Object.freeze({ ...current.settings, autoHintMode }),
  })

export const replaceActiveMatch = (
  current: MapachessPlayerData,
  activeMatch: DurableMatchRecord | null,
  challengeSetup?: ChallengeSetup,
): MapachessPlayerData => {
  if (
    challengeSetup !== undefined &&
    (activeMatch?.mode !== "challenge" ||
      activeMatch.opponentId !== challengeSetup.opponentId ||
      activeMatch.opponentTargetElo !== challengeSetup.difficultyTargetElo ||
      (challengeSetup.playerColor !== "random" &&
        activeMatch.playerColor !== challengeSetup.playerColor) ||
      activeMatch.startingPosition.variant !== challengeSetup.variant ||
      (challengeSetup.chess960PositionId !== null &&
        activeMatch.startingPosition.chess960PositionId !==
          challengeSetup.chess960PositionId))
  ) {
    throw new TypeError("Challenge setup must describe the match being saved.")
  }

  const historyMatch =
    activeMatch === null
      ? null
      : {
          ...activeMatch,
          opponentTargetElo: activeMatch.opponentTargetElo ?? null,
        }
  const challengeHistory = applyChallengeMatchResult(
    current.challengeHistory,
    current.activeMatch,
    historyMatch,
  )
  const firstAcceptedResult =
    activeMatch !== null &&
    activeMatch.conclusion !== null &&
    (current.activeMatch === null ||
      (current.activeMatch.matchId === activeMatch.matchId &&
        current.activeMatch.conclusion === null)) &&
    !current.processedMatchResultIds.includes(activeMatch.matchId)
  const ratedResult =
    firstAcceptedResult &&
    activeMatch !== null &&
    activeMatch.conclusion !== null &&
    typeof activeMatch.ratedOpponentElo === "number" &&
    current.activeMatch?.matchId === activeMatch.matchId &&
    current.activeMatch.ratedOpponentElo === activeMatch.ratedOpponentElo
      ? Object.freeze({
          variant: activeMatch.startingPosition.variant,
          before: current.ratings[activeMatch.startingPosition.variant],
          after: updatedPlayerElo(
            current.ratings[activeMatch.startingPosition.variant],
            current.ratedMatchCounts[activeMatch.startingPosition.variant],
            activeMatch.ratedOpponentElo,
            playerResultScore(activeMatch.conclusion, activeMatch.playerColor),
          ),
        })
      : null
  const awardedXp =
    firstAcceptedResult && activeMatch !== null
      ? completedMatchXpAward(activeMatch)
      : 0
  const totalXp = current.totalXp + awardedXp
  if (!Number.isSafeInteger(totalXp)) {
    throw new RangeError("Global XP exceeds the supported save range.")
  }
  const newlyUnlockedAchievements = firstAcceptedResult
    ? levelAchievementsCrossed(current.totalXp, totalXp)
    : Object.freeze([])
  return Object.freeze({
    ...current,
    activeMatch,
    challengeHistory:
      challengeSetup !== undefined && historyMatch !== null
        ? recordChallengeStart(challengeHistory, historyMatch)
        : challengeHistory,
    processedMatchResultIds: firstAcceptedResult
      ? Object.freeze([...current.processedMatchResultIds, activeMatch.matchId])
      : current.processedMatchResultIds,
    lastAcceptedResultReward:
      firstAcceptedResult && activeMatch !== null
        ? Object.freeze({
            matchId: activeMatch.matchId,
            awardedXp,
            totalXpBefore: current.totalXp,
            unlockedAchievementIds: newlyUnlockedAchievements,
            ratedElo: ratedResult,
          })
        : current.lastAcceptedResultReward,
    totalXp,
    unlockedAchievementIds:
      newlyUnlockedAchievements.length > 0
        ? Object.freeze([
            ...current.unlockedAchievementIds,
            ...newlyUnlockedAchievements,
          ])
        : current.unlockedAchievementIds,
    ratedMatchCounts:
      ratedResult !== null
        ? Object.freeze({
            ...current.ratedMatchCounts,
            [ratedResult.variant]:
              current.ratedMatchCounts[ratedResult.variant] + 1,
          })
        : current.ratedMatchCounts,
    ratings:
      ratedResult !== null
        ? Object.freeze({
            ...current.ratings,
            [ratedResult.variant]: ratedResult.after,
          })
        : current.ratings,
    storyProgress: applyStoryMatchResult(
      applyStoryMatchResult(current.storyProgress, current.activeMatch),
      activeMatch,
    ),
    revision: current.revision + 1,
    settings:
      activeMatch === null
        ? current.settings
        : Object.freeze({
            ...current.settings,
            autoHintMode: activeMatch.autoHintMode,
            challengeSetup: challengeSetup ?? current.settings.challengeSetup,
          }),
  })
}

export const resetPlayerElo = (
  current: MapachessPlayerData,
  variant: PlayerEloRatingId,
): MapachessPlayerData =>
  Object.freeze({
    ...current,
    ratedMatchCounts: Object.freeze({
      ...current.ratedMatchCounts,
      [variant]: 0,
    }),
    ratings: Object.freeze({
      ...current.ratings,
      [variant]: INITIAL_PLAYER_ELO,
    }),
    revision: current.revision + 1,
  })

export const createFreshRecoveryData = (
  lastKnownGood: DurablePlayerDataSlot,
): MapachessPlayerData =>
  freezePlayerData(
    createInitialMapachessPlayerData(),
    requiredRecoveryRevision(lastKnownGood),
  )

export const createLastKnownGoodRecoveryData = (
  lastKnownGood: Extract<DurablePlayerDataSlot, { type: "valid" }>,
): MapachessPlayerData =>
  freezePlayerData(lastKnownGood.data, requiredRecoveryRevision(lastKnownGood))

export const prepareImportedPlayerData = (
  imported: MapachessPlayerData,
  current: DurablePlayerDataSlot,
  lastKnownGood: DurablePlayerDataSlot,
): MapachessPlayerData =>
  freezePlayerData(
    imported,
    current.type === "invalid"
      ? requiredRecoveryRevision(lastKnownGood)
      : current.type === "missing"
        ? 0
        : current.data.revision + 1,
  )

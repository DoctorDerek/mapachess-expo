import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import applyChallengeMatchResult, {
  recordChallengeStart,
} from "./challengeHistory.js"
import type { DurablePlayerDataSlot } from "./durableStore.js"
import { requiredRecoveryRevision } from "./durableStore.js"
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
  const ratedVariant = activeMatch?.startingPosition.variant
  const ratedOpponentElo = activeMatch?.ratedOpponentElo
  const applyRatedResult =
    firstAcceptedResult &&
    ratedVariant !== undefined &&
    ratedOpponentElo !== undefined &&
    ratedOpponentElo !== null &&
    current.activeMatch?.matchId === activeMatch?.matchId &&
    current.activeMatch.ratedOpponentElo === ratedOpponentElo
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
    ratedMatchCounts: applyRatedResult
      ? Object.freeze({
          ...current.ratedMatchCounts,
          [ratedVariant]: current.ratedMatchCounts[ratedVariant] + 1,
        })
      : current.ratedMatchCounts,
    ratings: applyRatedResult
      ? Object.freeze({
          ...current.ratings,
          [ratedVariant]: updatedPlayerElo(
            current.ratings[ratedVariant],
            current.ratedMatchCounts[ratedVariant],
            ratedOpponentElo,
            playerResultScore(activeMatch.conclusion, activeMatch.playerColor),
          ),
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

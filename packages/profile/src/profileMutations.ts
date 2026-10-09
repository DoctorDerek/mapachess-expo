import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import accountActiveResult from "./activeResultAccounting.js"
import applyChallengeMatchResult, {
  recordChallengeStart,
} from "./challengeHistory.js"
import decodeChessAppearance, {
  type ChessAppearanceSettings,
} from "./chessAppearanceSettings.js"
import type { DurablePlayerDataSlot } from "./durableStore.js"
import { requiredRecoveryRevision } from "./durableStore.js"
import {
  decodePlayerAppearance,
  type PlayerAppearance,
} from "./playerAppearance.js"
import createInitialMapachessPlayerData, {
  INITIAL_PLAYER_ELO,
  type MapachessPlayerData,
  type PlayerEloRatingId,
} from "./playerData.js"
import applyStoryMatchResult from "./storyProgress.js"

export const changePlayerAppearance = (
  current: MapachessPlayerData,
  appearance: PlayerAppearance,
): MapachessPlayerData =>
  Object.freeze({
    ...current,
    appearance: decodePlayerAppearance(
      appearance,
      current.storyProgress,
      "$.appearance",
      current.appearance.animal === "chicken-stockfish" ? "preserve" : "reject",
    ),
    revision: current.revision + 1,
  })

export const changeChessAppearance = (
  current: MapachessPlayerData,
  chessAppearance: ChessAppearanceSettings,
): MapachessPlayerData =>
  Object.freeze({
    ...current,
    revision: current.revision + 1,
    settings: Object.freeze({
      ...current.settings,
      chessAppearance: decodeChessAppearance(chessAppearance),
    }),
  })

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
  const balances = accountActiveResult(current, activeMatch)
  const challengeHistory = applyChallengeMatchResult(
    balances.challengeHistory,
    current.activeMatch,
    historyMatch,
    false,
  )
  return Object.freeze({
    ...current,
    ...balances,
    activeMatch,
    challengeHistory:
      challengeSetup !== undefined && historyMatch !== null
        ? recordChallengeStart(challengeHistory, historyMatch)
        : challengeHistory,
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
    lastAcceptedResultReward:
      current.lastAcceptedResultReward?.contribution?.variant === variant
        ? Object.freeze({
            ...current.lastAcceptedResultReward,
            ratedElo: null,
            contribution: Object.freeze({
              ...current.lastAcceptedResultReward.contribution,
              ratedMatchCountBefore: null,
              eloState: current.lastAcceptedResultReward.contribution.applied
                ? "superseded"
                : "rebase",
            }),
          })
        : current.lastAcceptedResultReward,
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

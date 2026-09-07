import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { DurablePlayerDataSlot } from "./durableStore.js"
import { requiredRecoveryRevision } from "./durableStore.js"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "./playerData.js"
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
      activeMatch.playerColor !== challengeSetup.playerColor ||
      activeMatch.startingPosition.variant !== challengeSetup.variant ||
      (challengeSetup.chess960PositionId !== null &&
        activeMatch.startingPosition.chess960PositionId !==
          challengeSetup.chess960PositionId))
  ) {
    throw new TypeError("Challenge setup must describe the match being saved.")
  }

  return Object.freeze({
    ...current,
    activeMatch,
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

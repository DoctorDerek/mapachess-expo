import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { DurablePlayerDataSlot } from "./durableStore.js"
import { requiredRecoveryRevision } from "./durableStore.js"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "./playerData.js"

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
    settings: Object.freeze({ autoHintMode }),
  })

export const replaceActiveMatch = (
  current: MapachessPlayerData,
  activeMatch: DurableMatchRecord | null,
): MapachessPlayerData =>
  Object.freeze({
    ...current,
    activeMatch,
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

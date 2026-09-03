import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import {
  durableStoreSnapshotsEqual,
  type LoadedDurablePlayerData,
} from "./durableStore.js"
import type { MapachessPlayerData } from "./playerData.js"
import { canonicalPlayerData } from "./playerDataCodec.js"
import type {
  MapachessPortableBackup,
  PortableBackupDecodeResult,
} from "./portableBackup.js"
import type {
  PendingProfileWrite,
  PersistenceActorInput,
  PersistenceAttemptResult,
  ProfileMachineContext,
} from "./profileMachineTypes.js"
import {
  changeAutoHintMode,
  createFreshRecoveryData,
  createLastKnownGoodRecoveryData,
  prepareImportedPlayerData,
  replaceActiveMatch,
} from "./profileMutations.js"

export const storageRequestFailure = (): Readonly<{
  type: "PROFILE.STORAGE_REQUEST_FAILED"
}> => Object.freeze({ type: "PROFILE.STORAGE_REQUEST_FAILED" })

const persistenceRequestFailure = (): PersistenceAttemptResult => ({
  failure: storageRequestFailure(),
  ok: false,
})

export const requireLoaded = (
  context: ProfileMachineContext,
): LoadedDurablePlayerData => {
  if (context.loaded === null) {
    throw new Error("Profile workflow requires a completed durable load.")
  }
  return context.loaded
}

export const requireCurrentPlayerData = (
  context: ProfileMachineContext,
): MapachessPlayerData => {
  const current = requireLoaded(context).current
  if (current.type !== "valid") {
    throw new Error("Profile mutation requires valid current player data.")
  }
  return current.data
}

export const requirePendingWrite = (
  context: ProfileMachineContext,
): PendingProfileWrite => {
  if (context.pendingWrite === null) {
    throw new Error("Persistence workflow requires a pending write.")
  }
  return context.pendingWrite
}

export const requireImportRaw = (context: ProfileMachineContext): string => {
  if (context.importRaw === null) {
    throw new Error("Import decoding requires selected backup bytes.")
  }
  return context.importRaw
}

const requireImportPreview = (
  context: ProfileMachineContext,
): MapachessPortableBackup => {
  if (context.importPreview === null) {
    throw new Error("Import confirmation requires a verified preview.")
  }
  return context.importPreview
}

const pendingWrite = (
  expected: LoadedDurablePlayerData,
  candidate: MapachessPlayerData,
  operation: PendingProfileWrite["operation"],
): PendingProfileWrite => Object.freeze({ candidate, expected, operation })

export const prepareActiveMatchPending = (
  context: ProfileMachineContext,
  activeMatch: DurableMatchRecord | null,
): PendingProfileWrite => {
  const loaded = requireLoaded(context)
  return pendingWrite(
    loaded,
    replaceActiveMatch(requireCurrentPlayerData(context), activeMatch),
    "commit",
  )
}

export const prepareAutoHintModePending = (
  context: ProfileMachineContext,
  autoHintMode: MapachessPlayerData["settings"]["autoHintMode"],
): PendingProfileWrite => {
  const loaded = requireLoaded(context)
  return pendingWrite(
    loaded,
    changeAutoHintMode(requireCurrentPlayerData(context), autoHintMode),
    "commit",
  )
}

export const prepareFreshRecoveryPending = (
  context: ProfileMachineContext,
): PendingProfileWrite => {
  const loaded = requireLoaded(context)
  return pendingWrite(
    loaded,
    createFreshRecoveryData(loaded.lastKnownGood),
    "recovery",
  )
}

export const prepareImportPending = (
  context: ProfileMachineContext,
): PendingProfileWrite => {
  const loaded = requireLoaded(context)
  const candidate = prepareImportedPlayerData(
    requireImportPreview(context).payload,
    loaded.current,
    loaded.lastKnownGood,
  )
  return pendingWrite(
    loaded,
    candidate,
    loaded.current.type === "invalid" ? "recovery" : "import",
  )
}

export const prepareInitialPending = (
  context: ProfileMachineContext,
): PendingProfileWrite => {
  const loaded = requireLoaded(context)
  return pendingWrite(
    loaded,
    createFreshRecoveryData(loaded.lastKnownGood),
    "commit",
  )
}

export const prepareLastKnownGoodRecoveryPending = (
  context: ProfileMachineContext,
): PendingProfileWrite => {
  const loaded = requireLoaded(context)
  if (loaded.lastKnownGood.type !== "valid") {
    throw new Error("Last-known-good recovery requires a valid save.")
  }
  return pendingWrite(
    loaded,
    createLastKnownGoodRecoveryData(loaded.lastKnownGood),
    "recovery",
  )
}

export const executePendingWrite = async (
  input: PersistenceActorInput,
): Promise<PersistenceAttemptResult> => {
  try {
    switch (input.pendingWrite.operation) {
      case "commit":
        return await input.store.commitCurrent(
          input.pendingWrite.expected,
          input.pendingWrite.candidate,
        )
      case "import":
        return await input.store.replaceWithImportedData(
          input.pendingWrite.expected,
          input.pendingWrite.candidate,
        )
      case "recovery":
        return await input.store.recoverInvalidCurrent(
          input.pendingWrite.expected,
          input.pendingWrite.candidate,
        )
    }
  } catch {
    return persistenceRequestFailure()
  }
}

export const retryPendingWrite = async (
  input: PersistenceActorInput,
): Promise<PersistenceAttemptResult> => {
  let reloaded: LoadedDurablePlayerData
  try {
    reloaded = await input.store.load()
  } catch {
    return persistenceRequestFailure()
  }

  if (
    reloaded.current.type === "valid" &&
    canonicalPlayerData(reloaded.current.data) ===
      canonicalPlayerData(input.pendingWrite.candidate)
  ) {
    return { ok: true, state: reloaded }
  }
  if (
    !durableStoreSnapshotsEqual(
      reloaded.snapshot,
      input.pendingWrite.expected.snapshot,
    )
  ) {
    return {
      failure: Object.freeze({ type: "PROFILE.STORAGE_CONFLICT" }),
      ok: false,
    }
  }

  return executePendingWrite({
    pendingWrite: Object.freeze({
      ...input.pendingWrite,
      expected: reloaded,
    }),
    store: input.store,
  })
}

export const acceptedPersistenceUpdate = (
  result: PersistenceAttemptResult,
): Partial<ProfileMachineContext> =>
  result.ok
    ? {
        importIssue: null,
        importPreview: null,
        importRaw: null,
        loaded: result.state,
        pendingWrite: null,
        persistenceFailure: null,
      }
    : {}

export const persistenceFailureUpdate = (
  result: PersistenceAttemptResult,
): Partial<ProfileMachineContext> =>
  result.ok ? {} : { persistenceFailure: result.failure }

export const decodedImportPreviewUpdate = (
  result: PortableBackupDecodeResult,
): Partial<ProfileMachineContext> =>
  result.ok ? { importIssue: null, importPreview: result.backup } : {}

export const decodedImportIssueUpdate = (
  result: PortableBackupDecodeResult,
): Partial<ProfileMachineContext> =>
  result.ok
    ? {}
    : {
        importIssue: result.issue,
        importPreview: null,
        importRaw: null,
      }

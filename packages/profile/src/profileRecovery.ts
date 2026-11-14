import type { MapachessPlayerData } from "./playerData.js"
import type { MapachessPortableBackup } from "./portableBackup.js"
import {
  selectCurrentPlayerData,
  selectHasLastKnownGoodSave,
  selectImportIssue,
  selectImportPreview,
  selectPendingPlayerData,
  selectPersistenceFailure,
  selectUnreadablePlayerData,
  type ProfileImportIssue,
  type ProfileMachineSnapshot,
  type ProfilePersistenceFailure,
} from "./profileMachine.js"
import type { ProfileActor } from "./profileRuntime.js"

export type ProfileRecoveryState =
  | Readonly<{ kind: "none" | "load-failure" | "import-decoding" }>
  | Readonly<{
      kind: "recovery"
      hasLastKnownGood: boolean
      importIssue: ProfileImportIssue | null
    }>
  | Readonly<{ kind: "import-preview"; backup: MapachessPortableBackup }>
  | Readonly<{
      kind: "persistence-failure"
      failure: ProfilePersistenceFailure
      retrying: boolean
      canExportData: boolean
      canExportUnreadable: boolean
    }>

export type RecoveryFileState = Readonly<{
  status: "idle" | "busy" | "failed" | "too-large"
  operation: "import" | "export" | "unreadable" | null
}>

export type RecoveryFileActions = Readonly<{
  exportData: () => void
  exportUnreadable: () => void
  importData?: () => void
}>

export type RecoveryCommands = RecoveryFileActions &
  Readonly<{
    readBackup: (rawBackup: string) => void
    cancelImport: () => void
    confirmImport: () => void
    retryLoad: () => void
    retrySave: () => void
    restoreLastKnownGood: () => void
    reset: () => void
  }>

export const selectExportablePlayerData = (
  snapshot: ProfileMachineSnapshot,
): MapachessPlayerData | null =>
  selectPendingPlayerData(snapshot) ?? selectCurrentPlayerData(snapshot)

export default function selectProfileRecovery(
  snapshot: ProfileMachineSnapshot,
): ProfileRecoveryState {
  const backup = selectImportPreview(snapshot)
  if (snapshot.matches("importPreview") && backup !== null)
    return { kind: "import-preview", backup }
  if (snapshot.matches("loadFailure")) return { kind: "load-failure" }
  if (snapshot.matches("recovery"))
    return {
      kind: "recovery",
      hasLastKnownGood: selectHasLastKnownGoodSave(snapshot),
      importIssue: selectImportIssue(snapshot),
    }
  const failure = selectPersistenceFailure(snapshot)
  if (
    failure !== null &&
    (snapshot.matches("persistenceFailure") ||
      snapshot.matches("retryingPersistence"))
  )
    return {
      kind: "persistence-failure",
      failure,
      retrying: snapshot.matches("retryingPersistence"),
      canExportData: selectExportablePlayerData(snapshot) !== null,
      canExportUnreadable: selectUnreadablePlayerData(snapshot) !== null,
    }
  return snapshot.matches("importDecoding") &&
    selectCurrentPlayerData(snapshot) === null
    ? { kind: "import-decoding" }
    : { kind: "none" }
}

export function createRecoveryCommands(
  actor: ProfileActor,
  files: RecoveryFileActions,
): RecoveryCommands {
  return {
    ...files,
    readBackup: (rawBackup: string): void =>
      actor.send({ type: "PROFILE.IMPORT_PREVIEW_REQUESTED", rawBackup }),
    cancelImport: (): void => actor.send({ type: "PROFILE.IMPORT_CANCELLED" }),
    confirmImport: (): void => actor.send({ type: "PROFILE.IMPORT_CONFIRMED" }),
    retryLoad: (): void => actor.send({ type: "PROFILE.BOOT_RETRY_REQUESTED" }),
    retrySave: (): void =>
      actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" }),
    restoreLastKnownGood: (): void =>
      actor.send({ type: "PROFILE.RECOVERY_LAST_KNOWN_GOOD_REQUESTED" }),
    reset: (): void => actor.send({ type: "PROFILE.RECOVERY_RESET_CONFIRMED" }),
  }
}

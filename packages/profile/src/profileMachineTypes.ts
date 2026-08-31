import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type {
  DurablePlayerDataStore,
  DurablePlayerDataWriteFailure,
  DurablePlayerDataWriteResult,
  LoadedDurablePlayerData,
} from "./durableStore.js"
import type { MapachessPlayerData } from "./playerData.js"
import type {
  MapachessPortableBackup,
  PortableBackupDecodeIssue,
  PortableBackupDecodeResult,
} from "./portableBackup.js"

export type PortableBackupDecoder = (
  rawBackup: string,
) => Promise<PortableBackupDecodeResult>

export type ProfileMachineInput = Readonly<{
  decodePortableBackup: PortableBackupDecoder
  store: DurablePlayerDataStore
}>

export type ProfilePersistenceFailure =
  | DurablePlayerDataWriteFailure
  | Readonly<{ type: "PROFILE.STORAGE_REQUEST_FAILED" }>

export type ProfileImportIssue =
  | PortableBackupDecodeIssue
  | Readonly<{ path: "$"; type: "PROFILE.BACKUP_READ_FAILED" }>

export type PendingProfileWrite = Readonly<{
  candidate: MapachessPlayerData
  expected: LoadedDurablePlayerData
  operation: "commit" | "import" | "recovery"
}>

export type ProfileMachineContext = Readonly<{
  decodePortableBackup: PortableBackupDecoder
  importIssue: ProfileImportIssue | null
  importPreview: MapachessPortableBackup | null
  importRaw: string | null
  loadFailure: Readonly<{ type: "PROFILE.STORAGE_REQUEST_FAILED" }> | null
  loaded: LoadedDurablePlayerData | null
  pendingWrite: PendingProfileWrite | null
  persistenceFailure: ProfilePersistenceFailure | null
  store: DurablePlayerDataStore
}>

export type ProfileMachineEvent =
  | Readonly<{
      activeMatch: DurableMatchRecord | null
      type: "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED"
    }>
  | Readonly<{
      enabled: boolean
      type: "PROFILE.AUTO_HINTS_CHOICE_CONFIRMED"
    }>
  | Readonly<{
      enabled: boolean
      type: "PROFILE.AUTO_HINTS_SETTING_CHANGED"
    }>
  | Readonly<{ type: "PROFILE.BOOT_RETRY_REQUESTED" }>
  | Readonly<{ type: "PROFILE.IMPORT_CANCELLED" }>
  | Readonly<{ type: "PROFILE.IMPORT_CONFIRMED" }>
  | Readonly<{
      rawBackup: string
      type: "PROFILE.IMPORT_PREVIEW_REQUESTED"
    }>
  | Readonly<{ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" }>
  | Readonly<{
      type: "PROFILE.RECOVERY_LAST_KNOWN_GOOD_REQUESTED"
    }>
  | Readonly<{ type: "PROFILE.RECOVERY_RESET_CONFIRMED" }>

export type PersistenceActorInput = Readonly<{
  pendingWrite: PendingProfileWrite
  store: DurablePlayerDataStore
}>

export type LoadActorInput = Readonly<{ store: DurablePlayerDataStore }>

export type ImportActorInput = Readonly<{
  decodePortableBackup: PortableBackupDecoder
  rawBackup: string
}>

export type PersistenceAttemptResult =
  | DurablePlayerDataWriteResult
  | Readonly<{
      failure: Readonly<{ type: "PROFILE.STORAGE_REQUEST_FAILED" }>
      ok: false
    }>

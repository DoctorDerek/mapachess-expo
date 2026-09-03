import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import type { LoadedDurablePlayerData } from "./durableStore.js"
import type { MapachessPlayerData } from "./playerData.js"
import type {
  MapachessPortableBackup,
  PortableBackupDecodeResult,
} from "./portableBackup.js"
import type {
  ImportActorInput,
  LoadActorInput,
  PersistenceActorInput,
  PersistenceAttemptResult,
  ProfileImportIssue,
  ProfileMachineContext,
  ProfileMachineEvent,
  ProfileMachineInput,
  ProfilePersistenceFailure,
} from "./profileMachineTypes.js"
import {
  acceptedPersistenceUpdate,
  decodedImportIssueUpdate,
  decodedImportPreviewUpdate,
  executePendingWrite,
  persistenceFailureUpdate,
  prepareActiveMatchPending,
  prepareAutoHintModePending,
  prepareFreshRecoveryPending,
  prepareImportPending,
  prepareInitialPending,
  prepareLastKnownGoodRecoveryPending,
  requireCurrentPlayerData,
  requireImportRaw,
  requireLoaded,
  requirePendingWrite,
  retryPendingWrite,
  storageRequestFailure,
} from "./profileWorkflow.js"

export type {
  PortableBackupDecoder,
  ProfileImportIssue,
  ProfileMachineContext,
  ProfileMachineEvent,
  ProfileMachineInput,
  ProfilePersistenceFailure,
} from "./profileMachineTypes.js"

const importRequestTransition = {
  actions: "captureImportRequest",
  target: "importDecoding",
} as const

const profileMachineDefinition = setup({
  types: {
    context: {} as ProfileMachineContext,
    events: {} as ProfileMachineEvent,
    input: {} as ProfileMachineInput,
  },
  actors: {
    decodeImport: fromPromise<PortableBackupDecodeResult, ImportActorInput>(
      ({ input }) => input.decodePortableBackup(input.rawBackup),
    ),
    loadPlayerData: fromPromise<LoadedDurablePlayerData, LoadActorInput>(
      ({ input }) => input.store.load(),
    ),
    persistPendingWrite: fromPromise<
      PersistenceAttemptResult,
      PersistenceActorInput
    >(({ input }) => executePendingWrite(input)),
    retryPendingWrite: fromPromise<
      PersistenceAttemptResult,
      PersistenceActorInput
    >(({ input }) => retryPendingWrite(input)),
  },
  actions: {
    captureImportRequest: assign(({ event }) => {
      if (event.type !== "PROFILE.IMPORT_PREVIEW_REQUESTED") {
        throw new Error("Import action received a non-import event.")
      }
      return {
        importIssue: null,
        importPreview: null,
        importRaw: event.rawBackup,
      }
    }),
    clearImportPreview: assign({ importPreview: null, importRaw: null }),
    markImportReadFailure: assign({
      importIssue: Object.freeze({
        path: "$" as const,
        type: "PROFILE.BACKUP_READ_FAILED" as const,
      }),
      importPreview: null,
      importRaw: null,
    }),
    markLoadFailure: assign({ loadFailure: storageRequestFailure() }),
    prepareActiveMatchWrite: assign(({ context, event }) => {
      if (event.type !== "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED") {
        throw new Error("Match-save action received a non-match event.")
      }
      return {
        pendingWrite: prepareActiveMatchPending(context, event.activeMatch),
        persistenceFailure: null,
      }
    }),
    prepareAutoHintModeWrite: assign(({ context, event }) => {
      if (event.type !== "PROFILE.AUTO_HINT_MODE_CHANGED") {
        throw new Error("Settings action received a non-setting event.")
      }
      return {
        pendingWrite: prepareAutoHintModePending(context, event.autoHintMode),
        persistenceFailure: null,
      }
    }),
    prepareFreshRecoveryWrite: assign(({ context }) => ({
      pendingWrite: prepareFreshRecoveryPending(context),
      persistenceFailure: null,
    })),
    prepareImportWrite: assign(({ context }) => ({
      pendingWrite: prepareImportPending(context),
      persistenceFailure: null,
    })),
    prepareInitialWrite: assign(({ context }) => ({
      pendingWrite: prepareInitialPending(context),
      persistenceFailure: null,
    })),
    prepareLastKnownGoodRecoveryWrite: assign(({ context }) => ({
      pendingWrite: prepareLastKnownGoodRecoveryPending(context),
      persistenceFailure: null,
    })),
  },
  guards: {
    autoHintModeIsStandalone: ({ context }) =>
      requireCurrentPlayerData(context).activeMatch === null,
    currentIsInvalid: ({ context }) =>
      requireLoaded(context).current.type === "invalid",
    currentIsMissing: ({ context }) =>
      requireLoaded(context).current.type === "missing",
    hasLastKnownGood: ({ context }) =>
      requireLoaded(context).lastKnownGood.type === "valid",
  },
}).createMachine({
  id: "profile",
  initial: "loading",
  context: ({ input }) => ({
    decodePortableBackup: input.decodePortableBackup,
    importIssue: null,
    importPreview: null,
    importRaw: null,
    loadFailure: null,
    loaded: null,
    pendingWrite: null,
    persistenceFailure: null,
    store: input.store,
  }),
  states: {
    loading: {
      invoke: {
        id: "profile.loadPlayerData",
        src: "loadPlayerData",
        input: ({ context }) => ({ store: context.store }),
        onDone: {
          actions: assign(({ event }) => ({
            importPreview: null,
            loadFailure: null,
            loaded: event.output,
            pendingWrite: null,
            persistenceFailure: null,
          })),
          target: "routing",
        },
        onError: {
          actions: "markLoadFailure",
          target: "loadFailure",
        },
      },
    },
    loadFailure: {
      on: {
        "PROFILE.BOOT_RETRY_REQUESTED": {
          target: "loading",
        },
      },
    },
    routing: {
      always: [
        { guard: "currentIsInvalid", target: "recovery" },
        { guard: "currentIsMissing", target: "preparingInitial" },
        { target: "ready" },
      ],
    },
    preparingInitial: {
      entry: "prepareInitialWrite",
      always: "persisting",
    },
    ready: {
      on: {
        "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED": {
          actions: "prepareActiveMatchWrite",
          target: "persisting",
        },
        "PROFILE.AUTO_HINT_MODE_CHANGED": {
          actions: "prepareAutoHintModeWrite",
          guard: "autoHintModeIsStandalone",
          target: "persisting",
        },
        "PROFILE.IMPORT_PREVIEW_REQUESTED": importRequestTransition,
      },
    },
    recovery: {
      on: {
        "PROFILE.BOOT_RETRY_REQUESTED": {
          target: "loading",
        },
        "PROFILE.IMPORT_PREVIEW_REQUESTED": importRequestTransition,
        "PROFILE.RECOVERY_LAST_KNOWN_GOOD_REQUESTED": {
          actions: "prepareLastKnownGoodRecoveryWrite",
          guard: "hasLastKnownGood",
          target: "persisting",
        },
        "PROFILE.RECOVERY_RESET_CONFIRMED": {
          actions: "prepareFreshRecoveryWrite",
          target: "persisting",
        },
      },
    },
    importDecoding: {
      invoke: {
        id: "profile.decodeImport",
        src: "decodeImport",
        input: ({ context }) => ({
          decodePortableBackup: context.decodePortableBackup,
          rawBackup: requireImportRaw(context),
        }),
        onDone: [
          {
            actions: assign(({ event }) =>
              decodedImportPreviewUpdate(event.output),
            ),
            guard: ({ event }) => event.output.ok,
            target: "importPreview",
          },
          {
            actions: assign(({ event }) =>
              decodedImportIssueUpdate(event.output),
            ),
            target: "routing",
          },
        ],
        onError: {
          actions: "markImportReadFailure",
          target: "routing",
        },
      },
      on: {
        "PROFILE.IMPORT_CANCELLED": {
          actions: "clearImportPreview",
          target: "routing",
        },
      },
    },
    importPreview: {
      on: {
        "PROFILE.IMPORT_CANCELLED": {
          actions: "clearImportPreview",
          target: "routing",
        },
        "PROFILE.IMPORT_CONFIRMED": {
          actions: "prepareImportWrite",
          target: "persisting",
        },
      },
    },
    persisting: {
      invoke: {
        id: "profile.persistPendingWrite",
        src: "persistPendingWrite",
        input: ({ context }) => ({
          pendingWrite: requirePendingWrite(context),
          store: context.store,
        }),
        onDone: [
          {
            actions: assign(({ event }) =>
              acceptedPersistenceUpdate(event.output),
            ),
            guard: ({ event }) => event.output.ok,
            target: "routing",
          },
          {
            actions: assign(({ event }) =>
              persistenceFailureUpdate(event.output),
            ),
            target: "persistenceFailure",
          },
        ],
      },
    },
    persistenceFailure: {
      on: {
        "PROFILE.PERSISTENCE_RETRY_REQUESTED": {
          target: "retryingPersistence",
        },
      },
    },
    retryingPersistence: {
      invoke: {
        id: "profile.persistRetry",
        src: "retryPendingWrite",
        input: ({ context }) => ({
          pendingWrite: requirePendingWrite(context),
          store: context.store,
        }),
        onDone: [
          {
            actions: assign(({ event }) =>
              acceptedPersistenceUpdate(event.output),
            ),
            guard: ({ event }) => event.output.ok,
            target: "routing",
          },
          {
            actions: assign(({ event }) =>
              persistenceFailureUpdate(event.output),
            ),
            target: "persistenceFailure",
          },
        ],
      },
    },
  },
})

export type ProfileMachineSnapshot = SnapshotFrom<
  typeof profileMachineDefinition
>

export const selectCurrentPlayerData = (
  snapshot: ProfileMachineSnapshot,
): MapachessPlayerData | null =>
  snapshot.context.loaded?.current.type === "valid"
    ? snapshot.context.loaded.current.data
    : null

export const selectPendingPlayerData = (
  snapshot: ProfileMachineSnapshot,
): MapachessPlayerData | null =>
  snapshot.context.pendingWrite?.candidate ?? null

export const selectUnreadablePlayerData = (
  snapshot: ProfileMachineSnapshot,
): string | null =>
  snapshot.context.loaded?.current.type === "invalid"
    ? snapshot.context.loaded.current.raw
    : null

export const selectImportPreview = (
  snapshot: ProfileMachineSnapshot,
): MapachessPortableBackup | null => snapshot.context.importPreview

export const selectImportIssue = (
  snapshot: ProfileMachineSnapshot,
): ProfileImportIssue | null => snapshot.context.importIssue

export const selectPersistenceFailure = (
  snapshot: ProfileMachineSnapshot,
): ProfilePersistenceFailure | null => snapshot.context.persistenceFailure

export const selectHasLastKnownGoodSave = (
  snapshot: ProfileMachineSnapshot,
): boolean => snapshot.context.loaded?.lastKnownGood.type === "valid"

export default profileMachineDefinition

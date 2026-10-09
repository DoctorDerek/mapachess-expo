import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import captureError from "@mapachess/diagnostics/error-diagnostic"
import decodeChessAppearance, {
  sameChessAppearance,
} from "./chessAppearanceSettings.js"
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
  prepareAppearancePending,
  prepareAutoHintModePending,
  prepareChessAppearancePending,
  prepareEloResetPending,
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
    rememberChessAppearance: assign(({ context, event }) => {
      if (event.type !== "PROFILE.CHESS_APPEARANCE_CHANGED")
        throw new Error("Chess appearance requires a preference event.")
      const previous =
        context.requestedChessAppearance ??
        context.pendingWrite?.candidate.settings.chessAppearance ??
        requireCurrentPlayerData(context).settings.chessAppearance
      return {
        requestedChessAppearance: decodeChessAppearance({
          ...previous,
          ...event.change,
        }),
      }
    }),
    prepareRequestedChessAppearanceWrite: assign(({ context }) => {
      if (context.requestedChessAppearance === null)
        throw new Error("A requested chess appearance is required.")
      return {
        pendingWrite: prepareChessAppearancePending(
          context,
          context.requestedChessAppearance,
        ),
        requestedChessAppearance: null,
        persistenceFailure: null,
      }
    }),
    clearRequestedChessAppearance: assign({ requestedChessAppearance: null }),
    prepareAppearanceWrite: assign(({ context, event }) => {
      if (event.type !== "PROFILE.APPEARANCE_SAVE_REQUESTED")
        throw new Error("Appearance save requires an appearance event.")
      return {
        pendingWrite: prepareAppearancePending(context, event.appearance),
        persistenceFailure: null,
      }
    }),
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
    markImportReadFailure: assign(
      (_, { error }: Readonly<{ error: unknown }>) => ({
        importIssue: Object.freeze({
          diagnostic: captureError(error),
          path: "$" as const,
          type: "PROFILE.BACKUP_READ_FAILED" as const,
        }),
        importPreview: null,
        importRaw: null,
      }),
    ),
    markLoadFailure: assign((_, { error }: Readonly<{ error: unknown }>) => ({
      loadFailure: storageRequestFailure(error),
    })),
    prepareActiveMatchWrite: assign(({ context, event }) => {
      if (event.type !== "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED") {
        throw new Error("Match-save action received a non-match event.")
      }
      return {
        pendingWrite: prepareActiveMatchPending(
          context,
          event.activeMatch,
          event.challengeSetup,
        ),
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
    prepareEloResetWrite: assign(({ context, event }) => {
      if (event.type !== "PROFILE.ELO_RESET_CONFIRMED") {
        throw new Error("Elo-reset action received a non-reset event.")
      }
      return {
        pendingWrite: prepareEloResetPending(context, event.variant),
        persistenceFailure: null,
      }
    }),
    rememberAutoHintMode: assign(({ event }) => {
      if (event.type !== "PROFILE.AUTO_HINT_MODE_CHANGED") {
        throw new Error("Settings action received a non-setting event.")
      }
      return { requestedAutoHintMode: event.autoHintMode }
    }),
    prepareRequestedAutoHintModeWrite: assign(({ context }) => {
      if (context.requestedAutoHintMode === null) {
        throw new Error("A requested hint preference is required.")
      }
      return {
        pendingWrite: prepareAutoHintModePending(
          context,
          context.requestedAutoHintMode,
        ),
        requestedAutoHintMode: null,
        persistenceFailure: null,
      }
    }),
    clearRequestedAutoHintMode: assign({ requestedAutoHintMode: null }),
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
    profileCommitIsSaving: ({ context }) =>
      context.loaded?.current.type === "valid" &&
      context.pendingWrite?.operation === "commit",
    requestedChessAppearanceDiffers: ({ context }) =>
      context.requestedChessAppearance !== null &&
      !sameChessAppearance(
        context.requestedChessAppearance,
        requireCurrentPlayerData(context).settings.chessAppearance,
      ),
    requestedChessAppearanceExists: ({ context }) =>
      context.requestedChessAppearance !== null,
    autoHintModeIsStandalone: ({ context }) =>
      requireCurrentPlayerData(context).activeMatch === null,
    standalonePreferenceIsSaving: ({ context }) =>
      context.loaded?.current.type === "valid" &&
      context.loaded.current.data.activeMatch === null &&
      context.pendingWrite?.operation === "commit" &&
      context.pendingWrite.candidate.activeMatch === null,
    requestedAutoHintModeDiffers: ({ context }) =>
      context.requestedAutoHintMode !== null &&
      context.requestedAutoHintMode !==
        requireCurrentPlayerData(context).settings.autoHintMode,
    requestedAutoHintModeExists: ({ context }) =>
      context.requestedAutoHintMode !== null,
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
    requestedAutoHintMode: null,
    requestedChessAppearance: null,
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
          actions: {
            type: "markLoadFailure",
            params: ({ event }) => ({ error: event.error }),
          },
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
      always: [
        {
          guard: "requestedChessAppearanceDiffers",
          actions: "prepareRequestedChessAppearanceWrite",
          target: "persisting",
        },
        {
          guard: "requestedChessAppearanceExists",
          actions: "clearRequestedChessAppearance",
        },
        {
          guard: "requestedAutoHintModeDiffers",
          actions: "prepareRequestedAutoHintModeWrite",
          target: "persisting",
        },
        {
          guard: "requestedAutoHintModeExists",
          actions: "clearRequestedAutoHintMode",
        },
      ],
      on: {
        "PROFILE.CHESS_APPEARANCE_CHANGED": {
          actions: "rememberChessAppearance",
        },
        "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED": {
          actions: "prepareActiveMatchWrite",
          target: "persisting",
        },
        "PROFILE.APPEARANCE_SAVE_REQUESTED": {
          actions: "prepareAppearanceWrite",
          target: "persisting",
        },
        "PROFILE.AUTO_HINT_MODE_CHANGED": {
          actions: "prepareAutoHintModeWrite",
          guard: "autoHintModeIsStandalone",
          target: "persisting",
        },
        "PROFILE.ELO_RESET_CONFIRMED": {
          actions: "prepareEloResetWrite",
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
          actions: {
            type: "markImportReadFailure",
            params: ({ event }) => ({ error: event.error }),
          },
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
      on: {
        "PROFILE.CHESS_APPEARANCE_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberChessAppearance",
        },
        "PROFILE.AUTO_HINT_MODE_CHANGED": {
          guard: "standalonePreferenceIsSaving",
          actions: "rememberAutoHintMode",
        },
      },
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
      on: {
        "PROFILE.CHESS_APPEARANCE_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberChessAppearance",
        },
        "PROFILE.AUTO_HINT_MODE_CHANGED": {
          guard: "standalonePreferenceIsSaving",
          actions: "rememberAutoHintMode",
        },
      },
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
): MapachessPlayerData | null => {
  const candidate = snapshot.context.pendingWrite?.candidate
  if (candidate === undefined) return null
  const requested = snapshot.context.requestedAutoHintMode
  const appearance = snapshot.context.requestedChessAppearance
  return requested === null && appearance === null
    ? candidate
    : {
        ...candidate,
        settings: {
          ...candidate.settings,
          autoHintMode: requested ?? candidate.settings.autoHintMode,
          chessAppearance: appearance ?? candidate.settings.chessAppearance,
        },
      }
}

export const selectCanChangeChessAppearance = (
  snapshot: ProfileMachineSnapshot,
): boolean =>
  selectCurrentPlayerData(snapshot) !== null &&
  (snapshot.matches("ready") ||
    ((snapshot.matches("persisting") ||
      snapshot.matches("retryingPersistence")) &&
      snapshot.context.pendingWrite?.operation === "commit"))

export const selectCanChangeAutoHintMode = (
  snapshot: ProfileMachineSnapshot,
): boolean => {
  const current = selectCurrentPlayerData(snapshot)
  return (
    current !== null &&
    current.activeMatch === null &&
    (snapshot.matches("ready") ||
      ((snapshot.matches("persisting") ||
        snapshot.matches("retryingPersistence")) &&
        snapshot.context.pendingWrite?.operation === "commit" &&
        snapshot.context.pendingWrite.candidate.activeMatch === null))
  )
}

export const selectCanNavigateProfile = (
  snapshot: ProfileMachineSnapshot,
): boolean =>
  !snapshot.matches("recovery") &&
  !snapshot.matches("importPreview") &&
  !snapshot.matches("persistenceFailure") &&
  !snapshot.matches("retryingPersistence") &&
  !snapshot.matches("loadFailure")

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

import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import captureError from "@mapachess/diagnostics/error-diagnostic"
import {
  parsePlayerInputBindings,
  samePlayerInputBindings,
} from "@mapachess/match/player-input"
import type { LoadedDurablePlayerData } from "./durableStore.js"
import { isShippedLocale } from "./locale.js"
import type { MapachessPlayerData } from "./playerData.js"
import type {
  MapachessPortableBackup,
  PortableBackupDecodeResult,
} from "./portableBackup.js"
import validatePresentationPreferences, {
  samePresentationPreferences,
} from "./presentationPreferences.js"
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
  prepareEloResetPending,
  prepareFirstArrivalPending,
  prepareFreshRecoveryPending,
  prepareImportPending,
  prepareInitialPending,
  prepareInputBindingsPending,
  prepareLastKnownGoodRecoveryPending,
  preparePresentationPreferencesPending,
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
    rememberFirstArrivalPreferences: assign(({ context, event }) => {
      if (
        event.type !== "PROFILE.LOCALE_CHANGED" &&
        event.type !== "PROFILE.INTRODUCTION_COMPLETED"
      )
        throw new Error(
          "First-arrival preferences require a locale or introduction event.",
        )
      if (!isShippedLocale(event.locale))
        throw new TypeError("Only a shipped language may be selected.")
      const current =
        context.pendingWrite?.candidate ?? requireCurrentPlayerData(context)
      return {
        requestedFirstArrivalPreferences: Object.freeze({
          locale: event.locale,
          introductionCompleted:
            event.type === "PROFILE.INTRODUCTION_COMPLETED" ||
            (context.requestedFirstArrivalPreferences?.introductionCompleted ??
              current.introductionCompleted),
        }),
      }
    }),
    prepareRequestedFirstArrivalWrite: assign(({ context }) => {
      if (context.requestedFirstArrivalPreferences === null)
        throw new Error("Requested first-arrival preferences are required.")
      return {
        pendingWrite: prepareFirstArrivalPending(
          context,
          context.requestedFirstArrivalPreferences,
        ),
        requestedFirstArrivalPreferences: null,
        persistenceFailure: null,
      }
    }),
    clearRequestedFirstArrivalPreferences: assign({
      requestedFirstArrivalPreferences: null,
    }),
    rememberInputBindings: assign(({ event }) => {
      if (event.type !== "PROFILE.INPUT_BINDINGS_SAVE_REQUESTED")
        throw new Error("Input settings require a binding event.")
      const requestedInputBindings = parsePlayerInputBindings(event.bindings)
      if (requestedInputBindings === null)
        throw new TypeError("Input settings must be validated before saving.")
      return { requestedInputBindings }
    }),
    prepareRequestedInputWrite: assign(({ context }) => {
      if (context.requestedInputBindings === null)
        throw new Error("Requested input bindings are required.")
      return {
        pendingWrite: prepareInputBindingsPending(
          context,
          context.requestedInputBindings,
        ),
        requestedInputBindings: null,
        persistenceFailure: null,
      }
    }),
    clearRequestedInputBindings: assign({ requestedInputBindings: null }),
    rememberPresentationPreferences: assign(({ context, event }) => {
      if (
        event.type !== "PROFILE.CHESS_APPEARANCE_CHANGED" &&
        event.type !== "PROFILE.COACH_COLLECTION_CHANGED"
      )
        throw new Error("Presentation preferences require a preference event.")
      const previous =
        context.requestedPresentationPreferences ??
        context.pendingWrite?.candidate.settings ??
        requireCurrentPlayerData(context).settings
      return {
        requestedPresentationPreferences: validatePresentationPreferences(
          event.type === "PROFILE.COACH_COLLECTION_CHANGED"
            ? { ...previous, coachCollection: event.coachCollection }
            : {
                ...previous,
                chessAppearance: {
                  ...previous.chessAppearance,
                  ...event.change,
                },
              },
        ),
      }
    }),
    prepareRequestedPresentationWrite: assign(({ context }) => {
      if (context.requestedPresentationPreferences === null)
        throw new Error("Requested presentation preferences are required.")
      return {
        pendingWrite: preparePresentationPreferencesPending(
          context,
          context.requestedPresentationPreferences,
        ),
        requestedPresentationPreferences: null,
        persistenceFailure: null,
      }
    }),
    clearRequestedPresentationPreferences: assign({
      requestedPresentationPreferences: null,
    }),
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
    requestedFirstArrivalPreferencesDiffer: ({ context }) => {
      const requested = context.requestedFirstArrivalPreferences
      const current = requireCurrentPlayerData(context)
      return (
        requested !== null &&
        (requested.locale !== current.settings.locale ||
          requested.introductionCompleted !== current.introductionCompleted)
      )
    },
    requestedFirstArrivalPreferencesExist: ({ context }) =>
      context.requestedFirstArrivalPreferences !== null,
    requestedInputBindingsDiffer: ({ context }) =>
      context.requestedInputBindings !== null &&
      !samePlayerInputBindings(
        context.requestedInputBindings,
        requireCurrentPlayerData(context).settings.inputBindings,
      ),
    requestedInputBindingsExist: ({ context }) =>
      context.requestedInputBindings !== null,
    profileCommitIsSaving: ({ context }) =>
      context.loaded?.current.type === "valid" &&
      context.pendingWrite?.operation === "commit",
    requestedPresentationPreferencesDiffers: ({ context }) =>
      context.requestedPresentationPreferences !== null &&
      !samePresentationPreferences(
        context.requestedPresentationPreferences,
        requireCurrentPlayerData(context).settings,
      ),
    requestedPresentationPreferencesExist: ({ context }) =>
      context.requestedPresentationPreferences !== null,
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
    requestedPresentationPreferences: null,
    requestedInputBindings: null,
    requestedFirstArrivalPreferences: null,
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
          guard: "requestedFirstArrivalPreferencesDiffer",
          actions: "prepareRequestedFirstArrivalWrite",
          target: "persisting",
        },
        {
          guard: "requestedFirstArrivalPreferencesExist",
          actions: "clearRequestedFirstArrivalPreferences",
        },
        {
          guard: "requestedInputBindingsDiffer",
          actions: "prepareRequestedInputWrite",
          target: "persisting",
        },
        {
          guard: "requestedInputBindingsExist",
          actions: "clearRequestedInputBindings",
        },
        {
          guard: "requestedPresentationPreferencesDiffers",
          actions: "prepareRequestedPresentationWrite",
          target: "persisting",
        },
        {
          guard: "requestedPresentationPreferencesExist",
          actions: "clearRequestedPresentationPreferences",
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
        "PROFILE.LOCALE_CHANGED": {
          actions: "rememberFirstArrivalPreferences",
        },
        "PROFILE.INTRODUCTION_COMPLETED": {
          actions: "rememberFirstArrivalPreferences",
        },
        "PROFILE.CHESS_APPEARANCE_CHANGED": {
          actions: "rememberPresentationPreferences",
        },
        "PROFILE.INPUT_BINDINGS_SAVE_REQUESTED": {
          actions: "rememberInputBindings",
        },
        "PROFILE.COACH_COLLECTION_CHANGED": {
          actions: "rememberPresentationPreferences",
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
        "PROFILE.LOCALE_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberFirstArrivalPreferences",
        },
        "PROFILE.INTRODUCTION_COMPLETED": {
          guard: "profileCommitIsSaving",
          actions: "rememberFirstArrivalPreferences",
        },
        "PROFILE.INPUT_BINDINGS_SAVE_REQUESTED": {
          guard: "profileCommitIsSaving",
          actions: "rememberInputBindings",
        },
        "PROFILE.CHESS_APPEARANCE_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberPresentationPreferences",
        },
        "PROFILE.COACH_COLLECTION_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberPresentationPreferences",
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
        "PROFILE.LOCALE_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberFirstArrivalPreferences",
        },
        "PROFILE.INTRODUCTION_COMPLETED": {
          guard: "profileCommitIsSaving",
          actions: "rememberFirstArrivalPreferences",
        },
        "PROFILE.INPUT_BINDINGS_SAVE_REQUESTED": {
          guard: "profileCommitIsSaving",
          actions: "rememberInputBindings",
        },
        "PROFILE.CHESS_APPEARANCE_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberPresentationPreferences",
        },
        "PROFILE.COACH_COLLECTION_CHANGED": {
          guard: "profileCommitIsSaving",
          actions: "rememberPresentationPreferences",
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
  const appearance = snapshot.context.requestedPresentationPreferences
  const bindings = snapshot.context.requestedInputBindings
  const arrival = snapshot.context.requestedFirstArrivalPreferences
  return requested === null &&
    appearance === null &&
    bindings === null &&
    arrival === null
    ? candidate
    : {
        ...candidate,
        introductionCompleted:
          arrival?.introductionCompleted ?? candidate.introductionCompleted,
        settings: {
          ...candidate.settings,
          autoHintMode: requested ?? candidate.settings.autoHintMode,
          ...appearance,
          inputBindings: bindings ?? candidate.settings.inputBindings,
          locale: arrival?.locale ?? candidate.settings.locale,
        },
      }
}

export const selectCanChangePresentationPreferences = (
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

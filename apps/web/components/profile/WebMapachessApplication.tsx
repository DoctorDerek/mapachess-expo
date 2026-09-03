"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useRef, useState } from "react"
import type { ActorRefFrom } from "xstate"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import profileMachine, {
  selectCurrentPlayerData,
  selectHasLastKnownGoodSave,
  selectImportIssue,
  selectImportPreview,
  selectPendingPlayerData,
  selectPersistenceFailure,
  selectUnreadablePlayerData,
} from "@mapachess/profile/profile-machine"
import openWebProfileRuntime, {
  type WebProfileRuntime,
} from "../../lib/profile/openWebProfileRuntime"
import {
  createWebPlayerDataBackup,
  downloadTextFile,
  MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME,
  MAPACHESS_UNREADABLE_DATA_FILE_NAME,
} from "../../lib/profile/webPlayerDataFiles"
import StandardChickenGame from "../gameplay/StandardChickenGame"
import FirstRunProfilePanel from "./FirstRunProfilePanel"
import FullPageProfilePanel, {
  ImportBackupButton,
  primaryProfileButtonClasses,
} from "./ProfileFoundation"
import ProfileImportPreviewPanel from "./ProfileImportPreviewPanel"
import ProfilePersistenceFailurePanel from "./ProfilePersistenceFailurePanel"
import ProfileRecoveryPanel from "./ProfileRecoveryPanel"
import ProfileSettingsPanel from "./ProfileSettingsPanel"

type ProfileRuntimeState =
  | Readonly<{ status: "opening" }>
  | Readonly<{ runtime: WebProfileRuntime; status: "ready" }>
  | Readonly<{ status: "unsupported" }>

type ProfileActor = ActorRefFrom<typeof profileMachine>

const completedPlayerData = (
  playerData: MapachessPlayerData | null,
): playerData is MapachessPlayerData =>
  playerData?.firstRun.autoHintsChoiceCompleted === true

const standaloneCardClasses =
  "mapachess-shell grid place-items-start px-0 py-[clamp(1rem,3vw,2rem)]"

function ProfileExperience({ actor }: Readonly<{ actor: ProfileActor }>) {
  const snapshot = useSelector(actor, (current) => current)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const [exportFailed, setExportFailed] = useState(false)
  const currentPlayerData = selectCurrentPlayerData(snapshot)
  const pendingPlayerData = selectPendingPlayerData(snapshot)
  const exportablePlayerData = pendingPlayerData ?? currentPlayerData
  const unreadablePlayerData = selectUnreadablePlayerData(snapshot)
  const importIssue = selectImportIssue(snapshot)
  const importPreview = selectImportPreview(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)
  const playableProfile = completedPlayerData(currentPlayerData)
  const profileBusy =
    snapshot.matches("importDecoding") ||
    snapshot.matches("persisting") ||
    snapshot.matches("retryingPersistence")
  const profileActivityMessage = snapshot.matches("importDecoding")
    ? "Inspecting the selected backup. Nothing has been replaced."
    : snapshot.matches("persisting") || snapshot.matches("retryingPersistence")
      ? "Saving and verifying your local data…"
      : null

  const closeSettings = (): void => {
    setSettingsOpen(false)
    settingsButton.current?.focus()
  }

  const requestImportPreview = (rawBackup: string): void => {
    actor.send({ rawBackup, type: "PROFILE.IMPORT_PREVIEW_REQUESTED" })
  }

  const exportPlayerData = async (): Promise<void> => {
    if (exportablePlayerData === null) return
    try {
      const rawBackup = await createWebPlayerDataBackup(
        exportablePlayerData,
        globalThis.crypto.subtle,
      )
      downloadTextFile(rawBackup, MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME)
      setExportFailed(false)
    } catch {
      setExportFailed(true)
    }
  }

  const exportUnreadableData = (): void => {
    if (unreadablePlayerData === null) return
    try {
      downloadTextFile(
        unreadablePlayerData,
        MAPACHESS_UNREADABLE_DATA_FILE_NAME,
        "text/plain;charset=utf-8",
      )
      setExportFailed(false)
    } catch {
      setExportFailed(true)
    }
  }

  const exportFailure = exportFailed ? (
    <p
      className="mapachess-notice mapachess-notice--warning relative z-40 mx-auto mt-4 w-[calc(100%-2rem)] max-w-3xl text-sm"
      role="alert"
    >
      The download could not be created. Your local data is unchanged. Try again
      or use another browser download destination.
    </p>
  ) : null

  if (snapshot.matches("loadFailure")) {
    return (
      <FullPageProfilePanel
        description="Browser storage did not finish opening. Nothing has been reset or replaced."
        eyebrow="Local profile"
        live="assertive"
        title="Mapachess could not read local data."
      >
        <button
          autoFocus
          className={`${primaryProfileButtonClasses} mt-7`}
          onClick={() => actor.send({ type: "PROFILE.BOOT_RETRY_REQUESTED" })}
          type="button"
        >
          Try Again
        </button>
      </FullPageProfilePanel>
    )
  }

  if (snapshot.matches("firstRun")) {
    return (
      <FirstRunProfilePanel
        disabled={false}
        importIssue={importIssue}
        onAutoHintsChoice={(enabled) =>
          actor.send({
            enabled,
            type: "PROFILE.AUTO_HINTS_CHOICE_CONFIRMED",
          })
        }
        onBackupRead={requestImportPreview}
      />
    )
  }

  if (snapshot.matches("recovery")) {
    return (
      <ProfileRecoveryPanel
        downloadFailed={exportFailed}
        hasLastKnownGood={selectHasLastKnownGoodSave(snapshot)}
        importIssue={importIssue}
        onBackupRead={requestImportPreview}
        onExportUnreadable={exportUnreadableData}
        onResetConfirmed={() =>
          actor.send({ type: "PROFILE.RECOVERY_RESET_CONFIRMED" })
        }
        onRestoreLastKnownGood={() =>
          actor.send({
            type: "PROFILE.RECOVERY_LAST_KNOWN_GOOD_REQUESTED",
          })
        }
        onTryAgain={() => actor.send({ type: "PROFILE.BOOT_RETRY_REQUESTED" })}
      />
    )
  }

  const importPreviewPanel =
    snapshot.matches("importPreview") && importPreview !== null ? (
      <ProfileImportPreviewPanel
        backup={importPreview}
        onCancel={() => actor.send({ type: "PROFILE.IMPORT_CANCELLED" })}
        onConfirm={() => actor.send({ type: "PROFILE.IMPORT_CONFIRMED" })}
      />
    ) : null

  const persistenceFailurePanel =
    snapshot.matches("persistenceFailure") && persistenceFailure !== null ? (
      <ProfilePersistenceFailurePanel
        exportablePlayerData={exportablePlayerData}
        failure={persistenceFailure}
        onExportPlayerData={() => void exportPlayerData()}
        onExportUnreadable={
          unreadablePlayerData === null ? null : exportUnreadableData
        }
        onRetry={() =>
          actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
        }
      />
    ) : null
  const settingsPanelVisible =
    settingsOpen &&
    importPreviewPanel === null &&
    persistenceFailurePanel === null

  if (playableProfile) {
    return (
      <main>
        {exportFailure}
        {importPreviewPanel}
        {persistenceFailurePanel}
        {settingsPanelVisible ? (
          <ProfileSettingsPanel
            activityMessage={profileActivityMessage}
            importIssue={importIssue}
            onAutoHintsChanged={(enabled) =>
              actor.send({
                enabled,
                type: "PROFILE.AUTO_HINTS_SETTING_CHANGED",
              })
            }
            onBackupRead={requestImportPreview}
            onClose={closeSettings}
            onExportPlayerData={() => void exportPlayerData()}
            playerData={pendingPlayerData ?? currentPlayerData}
          />
        ) : null}
        <StandardChickenGame
          onSettingsRequested={() => setSettingsOpen(true)}
          profileActor={actor}
          settingsButtonRef={settingsButton}
          settingsOpen={settingsPanelVisible}
        />
      </main>
    )
  }

  if (importPreviewPanel !== null || persistenceFailurePanel !== null) {
    return (
      <main className={standaloneCardClasses}>
        <div className="w-full">
          {exportFailure}
          {importPreviewPanel}
          {persistenceFailurePanel}
        </div>
      </main>
    )
  }

  return (
    <FullPageProfilePanel
      description="Mapachess is opening, validating, and verifying this device’s local player data before enabling play."
      eyebrow="Local-only boot"
      live="polite"
      title={
        snapshot.matches("importDecoding")
          ? "Inspecting backup…"
          : profileBusy
            ? "Saving player data…"
            : "Opening Mapachess…"
      }
    >
      {snapshot.matches("importDecoding") ? (
        <button
          className={`${primaryProfileButtonClasses} mt-7`}
          onClick={() => actor.send({ type: "PROFILE.IMPORT_CANCELLED" })}
          type="button"
        >
          Cancel Import
        </button>
      ) : null}
    </FullPageProfilePanel>
  )
}

export default function WebMapachessApplication() {
  const [runtimeState, setRuntimeState] = useState<ProfileRuntimeState>({
    status: "opening",
  })

  useEffect(() => {
    if (
      globalThis.indexedDB === undefined ||
      globalThis.crypto?.subtle === undefined
    ) {
      setRuntimeState({ status: "unsupported" })
      return
    }

    let runtime: WebProfileRuntime | null = null
    try {
      runtime = openWebProfileRuntime({
        indexedDb: globalThis.indexedDB,
        subtleCrypto: globalThis.crypto.subtle,
      })
      setRuntimeState({ runtime, status: "ready" })
    } catch {
      setRuntimeState({ status: "unsupported" })
    }

    return () => {
      if (runtime !== null) void runtime.close().catch(() => undefined)
    }
  }, [])

  if (runtimeState.status === "ready") {
    return <ProfileExperience actor={runtimeState.runtime.actor} />
  }

  return (
    <FullPageProfilePanel
      description={
        runtimeState.status === "opening"
          ? "Preparing the local-only player-data runtime."
          : "This browser does not currently provide the local storage and integrity APIs Mapachess needs. No player data was changed."
      }
      eyebrow="Local profile"
      live={runtimeState.status === "opening" ? "polite" : "assertive"}
      title={
        runtimeState.status === "opening"
          ? "Opening Mapachess…"
          : "Local saves are unavailable."
      }
    />
  )
}

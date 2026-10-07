"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useRef, useState } from "react"
import { preload } from "react-dom"
import type { ActorRefFrom } from "xstate"
import type { PlayerEloRatingId } from "@mapachess/profile/player-data"
import profileMachine, {
  selectCurrentPlayerData,
  selectHasLastKnownGoodSave,
  selectImportIssue,
  selectImportPreview,
  selectPendingPlayerData,
  selectPersistenceFailure,
  selectUnreadablePlayerData,
} from "@mapachess/profile/profile-machine"
import { STOCKFISH_18_WEB_WASM_ARTIFACT } from "@mapachess/stockfish/web-runtime-identity"
import openWebProfileRuntime, {
  type WebProfileRuntime,
} from "../../lib/profile/openWebProfileRuntime"
import {
  createWebPlayerDataBackup,
  downloadTextFile,
  MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME,
  MAPACHESS_UNREADABLE_DATA_FILE_NAME,
} from "../../lib/profile/webPlayerDataFiles"
import MapachessButton from "../presentation/MapachessButton"
import MapachessLoadingSurface from "../presentation/MapachessLoadingSurface"
import MapachessNotice from "../presentation/MapachessNotice"
import MapachessShell from "../presentation/MapachessShell"
import FullPageProfilePanel, { ImportBackupButton } from "./ProfileFoundation"
import ProfileImportPreviewPanel from "./ProfileImportPreviewPanel"
import ProfilePersistenceFailurePanel from "./ProfilePersistenceFailurePanel"
import ProfilePlayExperience, {
  type ProfilePlayExperienceProps,
} from "./ProfilePlayExperience"
import ProfileRecoveryPanel from "./ProfileRecoveryPanel"

type ProfileRuntimeState =
  | Readonly<{ status: "opening" }>
  | Readonly<{ runtime: WebProfileRuntime; status: "ready" }>
  | Readonly<{ status: "unsupported" }>

type ProfileActor = ActorRefFrom<typeof profileMachine>
function ProfileExperience({ actor }: Readonly<{ actor: ProfileActor }>) {
  const snapshot = useSelector(actor, (current) => current)
  const [exportFailed, setExportFailed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportOperation = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      exportOperation.current?.abort()
      exportOperation.current = null
    },
    [],
  )
  const currentPlayerData = selectCurrentPlayerData(snapshot)
  const pendingPlayerData = selectPendingPlayerData(snapshot)
  const exportablePlayerData = pendingPlayerData ?? currentPlayerData
  const unreadablePlayerData = selectUnreadablePlayerData(snapshot)
  const importIssue = selectImportIssue(snapshot)
  const importPreview = selectImportPreview(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)
  const playableProfile = currentPlayerData !== null
  const profileActivityMessage = snapshot.matches("importDecoding")
    ? "Inspecting the selected backup. Nothing has been replaced."
    : snapshot.matches("persisting") || snapshot.matches("retryingPersistence")
      ? "Saving and verifying your local data…"
      : null

  const requestImportPreview = (rawBackup: string): void => {
    actor.send({ rawBackup, type: "PROFILE.IMPORT_PREVIEW_REQUESTED" })
  }

  const exportPlayerData = async (): Promise<void> => {
    if (exportablePlayerData === null || exportOperation.current !== null)
      return
    const operation = new AbortController()
    exportOperation.current = operation
    setExporting(true)
    try {
      const rawBackup = await createWebPlayerDataBackup(
        exportablePlayerData,
        globalThis.crypto.subtle,
      )
      if (operation.signal.aborted) return
      downloadTextFile(rawBackup, MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME)
      setExportFailed(false)
    } catch {
      if (!operation.signal.aborted) setExportFailed(true)
    } finally {
      if (exportOperation.current === operation) {
        exportOperation.current = null
        setExporting(false)
      }
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
    <MapachessNotice
      tone="warning"
      className="relative z-40 mx-auto mt-4 w-[calc(100%-2rem)] max-w-3xl text-sm"
      role="alert"
    >
      The download could not be created. Your local data is unchanged. Try again
      or use another browser download destination.
    </MapachessNotice>
  ) : null

  if (snapshot.matches("loadFailure")) {
    return (
      <FullPageProfilePanel
        description="Browser storage did not finish opening. Nothing has been reset or replaced."
        eyebrow="Local profile"
        live="assertive"
        title="Mapachess could not read local data."
      >
        <MapachessButton
          autoFocus
          className="mt-7"
          onClick={() => actor.send({ type: "PROFILE.BOOT_RETRY_REQUESTED" })}
          type="button"
        >
          Try Again
        </MapachessButton>
      </FullPageProfilePanel>
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
    (snapshot.matches("persistenceFailure") ||
      snapshot.matches("retryingPersistence")) &&
    persistenceFailure !== null ? (
      <ProfilePersistenceFailurePanel
        retrying={snapshot.matches("retryingPersistence")}
        exporting={exporting}
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
  if (playableProfile) {
    const settingsProps = {
      exporting,
      activityMessage: profileActivityMessage,
      importIssue,
      onBackupRead: requestImportPreview,
      onExportPlayerData: () => void exportPlayerData(),
      onEloResetConfirmed: (variant: PlayerEloRatingId): void => {
        actor.send({ type: "PROFILE.ELO_RESET_CONFIRMED", variant })
      },
    } satisfies ProfilePlayExperienceProps["settings"]

    return (
      <main>
        {exportFailure}
        {importPreviewPanel}
        {persistenceFailurePanel}
        <ProfilePlayExperience
          profileActor={actor}
          settings={settingsProps}
          blocked={
            importPreviewPanel !== null || persistenceFailurePanel !== null
          }
        />
      </main>
    )
  }

  if (importPreviewPanel !== null || persistenceFailurePanel !== null) {
    return (
      <MapachessShell as="main" className="grid place-items-start">
        <div className="w-full">
          {exportFailure}
          {importPreviewPanel}
          {persistenceFailurePanel}
        </div>
      </MapachessShell>
    )
  }

  if (!snapshot.matches("importDecoding")) return <MapachessLoadingSurface />

  return (
    <FullPageProfilePanel
      description="Inspecting the selected backup. Nothing has been replaced."
      eyebrow="Player data"
      live="polite"
      title="Inspecting backup…"
    >
      {snapshot.matches("importDecoding") ? (
        <MapachessButton
          className="mt-7"
          onClick={() => actor.send({ type: "PROFILE.IMPORT_CANCELLED" })}
          type="button"
        >
          Cancel Import
        </MapachessButton>
      ) : null}
    </FullPageProfilePanel>
  )
}

export default function WebMapachessApplication() {
  preload(`/stockfish-runtime/${STOCKFISH_18_WEB_WASM_ARTIFACT.fileName}`, {
    as: "fetch",
    crossOrigin: "anonymous",
    fetchPriority: "low",
    type: "application/wasm",
  })
  const [runtimeState, setRuntimeState] = useState<ProfileRuntimeState>({
    status: "opening",
  })
  const [openingAttempt, setOpeningAttempt] = useState(0)

  useEffect(() => {
    let runtime: WebProfileRuntime | null = null
    try {
      if (
        globalThis.indexedDB === undefined ||
        globalThis.crypto?.subtle === undefined
      ) {
        setRuntimeState({ status: "unsupported" })
        return
      }

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
  }, [openingAttempt])

  if (runtimeState.status === "ready") {
    return <ProfileExperience actor={runtimeState.runtime.actor} />
  }

  if (runtimeState.status === "opening") return <MapachessLoadingSurface />

  return (
    <FullPageProfilePanel
      description="This browser does not currently provide the local storage and integrity APIs Mapachess needs. No player data was changed."
      eyebrow="Local profile"
      live="assertive"
      title="Local saves are unavailable."
    >
      <MapachessButton
        className="mt-7"
        onClick={() => {
          setRuntimeState({ status: "opening" })
          setOpeningAttempt((attempt) => attempt + 1)
        }}
      >
        Try Again
      </MapachessButton>
    </FullPageProfilePanel>
  )
}

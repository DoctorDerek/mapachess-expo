"use client"

import { useSelector } from "@xstate/react"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import type { ActorRefFrom } from "xstate"
import ProfileRecovery from "@mapachess/application-ui/profile-recovery"
import type { PlayerEloRatingId } from "@mapachess/profile/player-data"
import profileMachine, {
  selectCurrentPlayerData,
  selectImportIssue,
  selectUnreadablePlayerData,
} from "@mapachess/profile/profile-machine"
import selectProfileRecovery, {
  createRecoveryCommands,
  selectExportablePlayerData,
} from "@mapachess/profile/profile-recovery"
import PlayerInputProvider, {
  usePlayerInputScope,
} from "@/components/input/PlayerInputProvider"
import MapachessButton from "@/components/presentation/MapachessButton"
import MapachessNotice from "@/components/presentation/MapachessNotice"
import MapachessShell from "@/components/presentation/MapachessShell"
import Introduction, {
  RestoringIntroduction,
} from "@/components/profile/Introduction"
import MapachessLocaleProvider, {
  useMapachessCopy,
  useMapachessLocale,
} from "@/components/profile/MapachessLocaleProvider"
import FullPageProfilePanel from "@/components/profile/ProfileFoundation"
import type { ProfilePlayExperienceProps } from "@/components/profile/ProfilePlayExperience"
import webRecoveryElements from "@/components/profile/WebRecoveryElements"
import openWebProfileRuntime, {
  type WebProfileRuntime,
} from "@/lib/profile/openWebProfileRuntime"
import {
  createWebPlayerDataBackup,
  downloadTextFile,
  MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME,
  MAPACHESS_UNREADABLE_DATA_FILE_NAME,
} from "@/lib/profile/webPlayerDataFiles"

type ProfileRuntimeState =
  | Readonly<{ status: "opening" }>
  | Readonly<{ runtime: WebProfileRuntime; status: "ready" }>
  | Readonly<{ status: "unsupported" }>

type ProfileActor = ActorRefFrom<typeof profileMachine>
const ProfilePlayExperience = dynamic(
  () => import("@/components/profile/ProfilePlayExperience"),
  {
    loading: RestoringIntroduction,
  },
)

function ProfileExperience({ actor }: Readonly<{ actor: ProfileActor }>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.webMapachessApplication

  const snapshot = useSelector(actor, (current) => current)
  const recoverySurface = useRef<HTMLElement>(null)
  usePlayerInputScope({
    root: recoverySurface,
    enabled: snapshot.matches("importPreview"),
    handle: (action) => {
      if (action !== "cancel") return false
      actor.send({ type: "PROFILE.IMPORT_CANCELLED" })
      return true
    },
  })
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
  const recovery = selectProfileRecovery(snapshot)
  const locale = useMapachessLocale()
  const unreadablePlayerData = selectUnreadablePlayerData(snapshot)
  const importIssue = selectImportIssue(snapshot)
  const playableProfile = currentPlayerData !== null
  const profileActivityMessage = snapshot.matches("importDecoding")
    ? copy.profile.inspectingBackup
    : snapshot.matches("persisting") || snapshot.matches("retryingPersistence")
      ? copy.profile.savingData
      : null

  const exportPlayerData = async (): Promise<void> => {
    const exportablePlayerData = selectExportablePlayerData(actor.getSnapshot())
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

  const commands = createRecoveryCommands(actor, {
    exportData: () => void exportPlayerData(),
    exportUnreadable: exportUnreadableData,
  })
  const sharedRecovery = (
    <ProfileRecovery
      state={recovery}
      commands={commands}
      files={{
        status: exporting ? "busy" : exportFailed ? "failed" : "idle",
        operation: "export",
      }}
      copy={copy}
      elements={webRecoveryElements}
      delivery="download"
    />
  )
  const exportFailure =
    exportFailed && recovery.kind === "none" ? (
      <MapachessNotice
        tone="warning"
        className="relative z-40 mx-auto mt-4 w-[calc(100%-2rem)] max-w-3xl text-sm"
        role="alert"
      >
        {messages.theDownloadCouldNotBeCreatedYour}
      </MapachessNotice>
    ) : null

  if (
    recovery.kind === "load-failure" ||
    recovery.kind === "recovery" ||
    recovery.kind === "import-decoding"
  )
    return sharedRecovery
  const blocked =
    recovery.kind === "import-preview" ||
    recovery.kind === "persistence-failure"
  if (playableProfile) {
    const settingsProps = {
      exporting,
      activityMessage: profileActivityMessage,
      importIssue,
      onBackupRead: commands.readBackup,
      onExportPlayerData: () => void exportPlayerData(),
      onEloResetConfirmed: (variant: PlayerEloRatingId): void => {
        actor.send({ type: "PROFILE.ELO_RESET_CONFIRMED", variant })
      },
    } satisfies ProfilePlayExperienceProps["settings"]

    return (
      <main ref={recoverySurface}>
        {exportFailure}
        {sharedRecovery}
        {!currentPlayerData.introductionCompleted ? (
          <Introduction
            locale={locale}
            pending={profileActivityMessage !== null}
            blocked={blocked}
            onLocaleChanged={(locale) =>
              actor.send({ type: "PROFILE.LOCALE_CHANGED", locale })
            }
            onStart={() =>
              actor.send({
                type: "PROFILE.INTRODUCTION_COMPLETED",
                locale,
              })
            }
          />
        ) : (
          <ProfilePlayExperience
            profileActor={actor}
            settings={settingsProps}
            blocked={blocked}
          />
        )}
      </main>
    )
  }

  if (blocked) {
    return (
      <MapachessShell as="main" className="grid place-items-start">
        <section ref={recoverySurface} className="w-full">
          {exportFailure}
          {sharedRecovery}
        </section>
      </MapachessShell>
    )
  }

  return (
    <main>
      <RestoringIntroduction />
    </main>
  )
}

export default function WebMapachessApplication() {
  const copy = useMapachessCopy()
  const messages = copy.interface.webMapachessApplication

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
    return (
      <PlayerInputProvider profileActor={runtimeState.runtime.actor}>
        <MapachessLocaleProvider actor={runtimeState.runtime.actor}>
          <ProfileExperience actor={runtimeState.runtime.actor} />
        </MapachessLocaleProvider>
      </PlayerInputProvider>
    )
  }

  if (runtimeState.status === "opening")
    return (
      <main>
        <RestoringIntroduction />
      </main>
    )

  return (
    <PlayerInputProvider profileActor={null}>
      <FullPageProfilePanel
        description={messages.thisBrowserDoesNotCurrentlyProvideThe}
        eyebrow={messages.localProfile}
        live="assertive"
        title={messages.localSavesAreUnavailable}
      >
        <MapachessButton
          className="mt-7"
          onClick={() => {
            setRuntimeState({ status: "opening" })
            setOpeningAttempt((attempt) => attempt + 1)
          }}
        >
          {messages.tryAgain}
        </MapachessButton>
      </FullPageProfilePanel>
    </PlayerInputProvider>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import FullPageProfilePanel, {
  ImportBackupButton,
  importIssueMessage,
} from "./ProfileFoundation"

export type ProfileRecoveryPanelProps = Readonly<{
  downloadFailed: boolean
  hasLastKnownGood: boolean
  importIssue: ProfileImportIssue | null
  onBackupRead: (rawBackup: string) => void
  onExportUnreadable: () => void
  onResetConfirmed: () => void
  onRestoreLastKnownGood: () => void
  onTryAgain: () => void
}>

export default function ProfileRecoveryPanel({
  downloadFailed,
  hasLastKnownGood,
  importIssue,
  onBackupRead,
  onExportUnreadable,
  onResetConfirmed,
  onRestoreLastKnownGood,
  onTryAgain,
}: ProfileRecoveryPanelProps) {
  const copy = useMapachessCopy()
  const messages = copy.interface.profileRecoveryPanel

  const [confirmingReset, setConfirmingReset] = useState(false)
  const resetTrigger = useRef<HTMLButtonElement>(null)
  const resetSurface = useRef<HTMLElement>(null)
  const restoreResetTriggerFocus = useRef(false)

  useEffect(() => {
    if (!confirmingReset && restoreResetTriggerFocus.current) {
      restoreResetTriggerFocus.current = false
      resetTrigger.current?.focus()
    }
  }, [confirmingReset])

  const cancelReset = (): void => {
    restoreResetTriggerFocus.current = true
    setConfirmingReset(false)
  }
  usePlayerInputScope({
    root: resetSurface,
    handle: (action) => {
      if (action !== "cancel") return false
      cancelReset()
      return true
    },
  })

  return (
    <FullPageProfilePanel
      description={messages.mapachessCouldNotSafelyReadTheCurrent}
      eyebrow={messages.localDataRecovery}
      live="assertive"
      title={messages.yourSaveNeedsAttention}
    >
      {downloadFailed ? (
        <MapachessNotice tone="warning" className="mt-6 text-sm" role="alert">
          {messages.theDownloadCouldNotBeCreatedYour}
        </MapachessNotice>
      ) : null}
      {importIssue === null ? null : (
        <MapachessNotice tone="warning" className="mt-6 text-sm" role="alert">
          {importIssueMessage(importIssue, copy.profile)}
        </MapachessNotice>
      )}

      {confirmingReset ? (
        <section
          ref={resetSurface}
          data-player-input-layer="recovery-reset"
          aria-labelledby="recovery-reset-title"
          className="border-mapachito-charcoal bg-mapachito-white inset-shadow-mapachito-red mt-8 rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-5 inset-shadow-[0.5rem_0_0]"
        >
          <h2
            className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
            id="recovery-reset-title"
          >
            {messages.resetAllLocalPlayerData}
          </h2>
          <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
            {messages.thisReplacesAllLocalPlayerDataIncluding}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <MapachessButton
              variant="secondary"
              autoFocus
              onClick={cancelReset}
              type="button"
            >
              {messages.cancel}
            </MapachessButton>
            <MapachessButton
              variant="secondary"
              onClick={onExportUnreadable}
              type="button"
            >
              {messages.exportUnreadableData}
            </MapachessButton>
            <MapachessButton
              variant="destructive"
              onClick={onResetConfirmed}
              type="button"
            >
              {messages.resetAllLocalPlayerData2}
            </MapachessButton>
          </div>
        </section>
      ) : (
        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <MapachessButton onClick={onTryAgain} type="button">
            {messages.tryAgain}
          </MapachessButton>
          <MapachessButton
            variant="secondary"
            onClick={onExportUnreadable}
            type="button"
          >
            {messages.exportUnreadableData}
          </MapachessButton>
          <ImportBackupButton disabled={false} onBackupRead={onBackupRead} />
          {hasLastKnownGood ? (
            <MapachessButton
              variant="secondary"
              onClick={onRestoreLastKnownGood}
              type="button"
            >
              {messages.restoreLastKnownGoodSave}
            </MapachessButton>
          ) : null}
          <MapachessButton
            variant="destructive"
            onClick={() => setConfirmingReset(true)}
            ref={resetTrigger}
            type="button"
          >
            {messages.reviewFullLocalReset}
          </MapachessButton>
        </div>
      )}
    </FullPageProfilePanel>
  )
}

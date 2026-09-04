"use client"

import { useEffect, useRef, useState } from "react"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
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
  const [confirmingReset, setConfirmingReset] = useState(false)
  const resetTrigger = useRef<HTMLButtonElement>(null)
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

  return (
    <FullPageProfilePanel
      description="Mapachess could not safely read the current local save. The available bytes are preserved, gameplay changes are frozen, and nothing has been reset."
      eyebrow="Local data recovery"
      live="assertive"
      title="Your save needs attention."
    >
      {downloadFailed ? (
        <MapachessNotice tone="warning" className="mt-6 text-sm" role="alert">
          The download could not be created. Your preserved local bytes are
          unchanged. Try again or use another browser download destination.
        </MapachessNotice>
      ) : null}
      {importIssue === null ? null : (
        <MapachessNotice tone="warning" className="mt-6 text-sm" role="alert">
          {importIssueMessage(importIssue)}
        </MapachessNotice>
      )}

      {confirmingReset ? (
        <section
          aria-labelledby="recovery-reset-title"
          className="mapachess-inset mapachess-inset--danger mt-8 p-5"
        >
          <h2 className="mapachess-subheading" id="recovery-reset-title">
            Reset all local player data?
          </h2>
          <p className="mapachess-muted mt-3 text-sm">
            This replaces the unreadable profile, removes the active match,
            resets all four ratings to 100, and restores default settings. It
            does not affect backup files you already exported.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <MapachessButton
              variant="secondary"
              autoFocus
              onClick={cancelReset}
              type="button"
            >
              Cancel
            </MapachessButton>
            <MapachessButton
              variant="secondary"
              onClick={onExportUnreadable}
              type="button"
            >
              Export Unreadable Data
            </MapachessButton>
            <MapachessButton
              variant="destructive"
              onClick={onResetConfirmed}
              type="button"
            >
              Reset All Local Player Data
            </MapachessButton>
          </div>
        </section>
      ) : (
        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <MapachessButton onClick={onTryAgain} type="button">
            Try Again
          </MapachessButton>
          <MapachessButton
            variant="secondary"
            onClick={onExportUnreadable}
            type="button"
          >
            Export Unreadable Data
          </MapachessButton>
          <ImportBackupButton disabled={false} onBackupRead={onBackupRead} />
          {hasLastKnownGood ? (
            <MapachessButton
              variant="secondary"
              onClick={onRestoreLastKnownGood}
              type="button"
            >
              Restore Last Known-Good Save
            </MapachessButton>
          ) : null}
          <MapachessButton
            variant="destructive"
            onClick={() => setConfirmingReset(true)}
            ref={resetTrigger}
            type="button"
          >
            Review Full Local Reset
          </MapachessButton>
        </div>
      )}
    </FullPageProfilePanel>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import FullPageProfilePanel, {
  destructiveProfileButtonClasses,
  ImportBackupButton,
  importIssueMessage,
  primaryProfileButtonClasses,
  secondaryProfileButtonClasses,
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
        <p
          className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100"
          role="alert"
        >
          The download could not be created. Your preserved local bytes are
          unchanged. Try again or use another browser download destination.
        </p>
      ) : null}
      {importIssue === null ? null : (
        <p
          className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100"
          role="alert"
        >
          {importIssueMessage(importIssue)}
        </p>
      )}

      {confirmingReset ? (
        <section
          aria-labelledby="recovery-reset-title"
          className="mt-7 rounded-2xl border border-rose-300/35 bg-rose-300/8 p-5"
        >
          <h2
            className="text-xl font-black text-white"
            id="recovery-reset-title"
          >
            Reset all local player data?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            This replaces the unreadable profile, removes the active match,
            resets all four ratings to 100, and restores default settings. It
            does not affect backup files you already exported.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              autoFocus
              className={secondaryProfileButtonClasses}
              onClick={cancelReset}
              type="button"
            >
              Cancel
            </button>
            <button
              className={secondaryProfileButtonClasses}
              onClick={onExportUnreadable}
              type="button"
            >
              Export Unreadable Data
            </button>
            <button
              className={destructiveProfileButtonClasses}
              onClick={onResetConfirmed}
              type="button"
            >
              Reset All Local Player Data
            </button>
          </div>
        </section>
      ) : (
        <div className="mt-8 grid gap-3 xl:grid-cols-2">
          <button
            className={primaryProfileButtonClasses}
            onClick={onTryAgain}
            type="button"
          >
            Try Again
          </button>
          <button
            className={secondaryProfileButtonClasses}
            onClick={onExportUnreadable}
            type="button"
          >
            Export Unreadable Data
          </button>
          <ImportBackupButton disabled={false} onBackupRead={onBackupRead} />
          {hasLastKnownGood ? (
            <button
              className={secondaryProfileButtonClasses}
              onClick={onRestoreLastKnownGood}
              type="button"
            >
              Restore Last Known-Good Save
            </button>
          ) : null}
          <button
            className={destructiveProfileButtonClasses}
            onClick={() => setConfirmingReset(true)}
            ref={resetTrigger}
            type="button"
          >
            Review Full Local Reset
          </button>
        </div>
      )}
    </FullPageProfilePanel>
  )
}

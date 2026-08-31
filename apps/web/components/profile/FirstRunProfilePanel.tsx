"use client"

import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import FullPageProfilePanel, {
  ImportBackupButton,
  importIssueMessage,
  primaryProfileButtonClasses,
  secondaryProfileButtonClasses,
} from "./ProfileFoundation"

export type FirstRunProfilePanelProps = Readonly<{
  disabled: boolean
  importIssue: ProfileImportIssue | null
  onAutoHintsChoice: (enabled: boolean) => void
  onBackupRead: (rawBackup: string) => void
}>

export default function FirstRunProfilePanel({
  disabled,
  importIssue,
  onAutoHintsChoice,
  onBackupRead,
}: FirstRunProfilePanelProps) {
  return (
    <FullPageProfilePanel
      description="Auto-Hints immediately demonstrate Mapachess’s core learning tool: three Piece Hints for each side, followed by a move for each hinted piece. You can change this setting later."
      eyebrow="Before your first game"
      title="Start with Auto-Hints?"
    >
      <div className="mt-8 grid gap-3 xl:grid-cols-2">
        <button
          autoFocus
          className={primaryProfileButtonClasses}
          disabled={disabled}
          onClick={() => onAutoHintsChoice(true)}
          type="button"
        >
          Keep Auto-Hints On
        </button>
        <button
          className={secondaryProfileButtonClasses}
          disabled={disabled}
          onClick={() => onAutoHintsChoice(false)}
          type="button"
        >
          Turn Auto-Hints Off
        </button>
      </div>
      <div className="mt-7 border-t border-white/10 pt-6">
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Already played elsewhere? Importing first shows a non-destructive
          preview.
        </p>
        <ImportBackupButton disabled={disabled} onBackupRead={onBackupRead} />
        {importIssue === null ? null : (
          <p
            className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100"
            role="alert"
          >
            {importIssueMessage(importIssue)}
          </p>
        )}
      </div>
    </FullPageProfilePanel>
  )
}

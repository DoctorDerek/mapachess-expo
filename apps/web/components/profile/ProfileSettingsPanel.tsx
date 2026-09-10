"use client"

import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import AutoHintModeChoices from "./AutoHintModeChoices"
import {
  ImportBackupButton,
  importIssueMessage,
  ProfileCard,
} from "./ProfileFoundation"

export type ProfileSettingsPanelProps = Readonly<{
  activityMessage: string | null
  hintChangesDisabled?: boolean
  autoHintMode: AutoHintMode
  importIssue: ProfileImportIssue | null
  onAutoHintModeChanged: (autoHintMode: AutoHintMode) => void
  onBackupRead: (rawBackup: string) => void
  onClose: () => void
  onExportPlayerData: () => void
}>

export default function ProfileSettingsPanel({
  activityMessage,
  hintChangesDisabled,
  autoHintMode,
  importIssue,
  onAutoHintModeChanged,
  onBackupRead,
  onClose,
  onExportPlayerData,
}: ProfileSettingsPanelProps) {
  const busy = activityMessage !== null

  return (
    <div
      aria-busy={busy}
      className="relative z-20 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)] aria-busy:[&_button:disabled]:opacity-100 aria-busy:[&_label:has(:disabled)]:opacity-100"
      id="profile-settings-panel"
    >
      <ProfileCard labelledBy="profile-settings-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
              Local profile
            </p>
            <h2
              className="font-display text-mapachito-charcoal mt-3 text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase"
              id="profile-settings-title"
            >
              Settings &amp; Player Data
            </h2>
          </div>
          <MapachessButton
            variant="secondary"
            autoFocus
            onClick={onClose}
            type="button"
          >
            Close Settings
          </MapachessButton>
        </div>

        <div className="mt-8">
          <p className="text-mapachito-charcoal mb-4 text-sm leading-[1.55] font-semibold opacity-76">
            Choose how Better Hints appear automatically. During a match,
            changes take effect immediately and become the default for future
            matches. Every Better Hint remains available manually.
          </p>
          <AutoHintModeChoices
            autoHintMode={autoHintMode}
            disabled={hintChangesDisabled ?? busy}
            onAutoHintModeChanged={onAutoHintModeChanged}
          />
        </div>

        <section aria-labelledby="player-data-actions-title" className="mt-7">
          <h2
            className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
            id="player-data-actions-title"
          >
            Portable Player Data
          </h2>
          <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
            Data stays on this device unless you explicitly download or import a
            JSON backup. Import first opens a non-destructive preview and is
            never applied before you review it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <MapachessButton onClick={onExportPlayerData} type="button">
              Export Player Data
            </MapachessButton>
            <ImportBackupButton disabled={busy} onBackupRead={onBackupRead} />
          </div>
        </section>

        {importIssue === null ? null : (
          <MapachessNotice tone="warning" className="mt-5 text-sm" role="alert">
            {importIssueMessage(importIssue)}
          </MapachessNotice>
        )}
        {activityMessage === null ? null : (
          <p className="sr-only" role="status">
            {activityMessage}
          </p>
        )}
      </ProfileCard>
    </div>
  )
}

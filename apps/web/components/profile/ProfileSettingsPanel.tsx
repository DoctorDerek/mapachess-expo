"use client"

import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import {
  ImportBackupButton,
  importIssueMessage,
  primaryProfileButtonClasses,
  ProfileCard,
  secondaryProfileButtonClasses,
} from "./ProfileFoundation"

export type ProfileSettingsPanelProps = Readonly<{
  activityMessage: string | null
  importIssue: ProfileImportIssue | null
  onAutoHintsChanged: (enabled: boolean) => void
  onBackupRead: (rawBackup: string) => void
  onClose: () => void
  onExportPlayerData: () => void
  playerData: MapachessPlayerData
}>

export default function ProfileSettingsPanel({
  activityMessage,
  importIssue,
  onAutoHintsChanged,
  onBackupRead,
  onClose,
  onExportPlayerData,
  playerData,
}: ProfileSettingsPanelProps) {
  const busy = activityMessage !== null

  return (
    <div
      className="relative z-20 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)]"
      id="profile-settings-panel"
    >
      <ProfileCard labelledBy="profile-settings-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mapachess-eyebrow">Local profile</p>
            <h2
              className="mapachess-section-title mt-3"
              id="profile-settings-title"
            >
              Settings &amp; Player Data
            </h2>
          </div>
          <button
            autoFocus
            className={secondaryProfileButtonClasses}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Close Settings
          </button>
        </div>

        <fieldset className="mapachess-inset mt-8 p-5">
          <legend className="px-2 font-black text-[var(--mapachito-ink)]">
            Better Hints
          </legend>
          <label className="flex min-h-12 cursor-pointer items-start gap-4">
            <input
              checked={playerData.settings.autoHintsEnabled}
              className="mapachess-checkbox mt-1"
              disabled={busy}
              onChange={(event) =>
                onAutoHintsChanged(event.currentTarget.checked)
              }
              type="checkbox"
            />
            <span>
              <span className="block font-black text-[var(--mapachito-ink)]">
                Start new matches with Auto-Hints
              </span>
              <span className="mapachess-muted mt-1 block text-sm">
                The active match keeps the setting it started with. You can
                still request Better Hints manually when Auto-Hints are off.
              </span>
            </span>
          </label>
        </fieldset>

        <section aria-labelledby="player-data-actions-title" className="mt-7">
          <h2 className="mapachess-subheading" id="player-data-actions-title">
            Portable Player Data
          </h2>
          <p className="mapachess-muted mt-3 text-sm">
            Data stays on this device unless you explicitly download or import a
            JSON backup. Import first opens a non-destructive preview and is
            never applied before you review it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={primaryProfileButtonClasses}
              onClick={onExportPlayerData}
              type="button"
            >
              Export Player Data
            </button>
            <ImportBackupButton disabled={busy} onBackupRead={onBackupRead} />
          </div>
        </section>

        {importIssue === null ? null : (
          <p
            className="mapachess-notice mapachess-notice--warning mt-5 text-sm"
            role="alert"
          >
            {importIssueMessage(importIssue)}
          </p>
        )}
        {activityMessage === null ? null : (
          <p
            aria-live="polite"
            className="mapachess-notice mt-5 text-sm"
            role="status"
          >
            {activityMessage}
          </p>
        )}
      </ProfileCard>
    </div>
  )
}

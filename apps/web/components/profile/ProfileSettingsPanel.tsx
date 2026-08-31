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
      className="relative z-10 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1rem,3vw,2rem)]"
      id="profile-settings-panel"
    >
      <ProfileCard labelledBy="profile-settings-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase">
              Local profile
            </p>
            <h2
              className="mt-2 text-3xl font-black tracking-[-0.035em] text-white"
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

        <fieldset className="mt-7 rounded-2xl border border-white/10 bg-slate-900/65 p-5">
          <legend className="px-2 font-black text-white">Better Hints</legend>
          <label className="flex min-h-12 cursor-pointer items-start gap-4">
            <input
              checked={playerData.settings.autoHintsEnabled}
              className="mt-1 size-5 accent-cyan-300"
              disabled={busy}
              onChange={(event) =>
                onAutoHintsChanged(event.currentTarget.checked)
              }
              type="checkbox"
            />
            <span>
              <span className="block font-bold text-slate-100">
                Start new matches with Auto-Hints
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-400">
                The active match keeps the setting it started with. You can
                still request Better Hints manually when Auto-Hints are off.
              </span>
            </span>
          </label>
        </fieldset>

        <section aria-labelledby="player-data-actions-title" className="mt-7">
          <h2
            className="text-lg font-black text-white"
            id="player-data-actions-title"
          >
            Portable Player Data
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
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
            className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100"
            role="alert"
          >
            {importIssueMessage(importIssue)}
          </p>
        )}
        {activityMessage === null ? null : (
          <p
            aria-live="polite"
            className="mt-5 font-semibold text-cyan-100"
            role="status"
          >
            {activityMessage}
          </p>
        )}
      </ProfileCard>
    </div>
  )
}

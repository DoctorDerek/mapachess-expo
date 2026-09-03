"use client"

import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import { AUTO_HINT_MODE_LABELS } from "../../lib/profile/autoHintModePresentation"
import {
  ImportBackupButton,
  importIssueMessage,
  primaryProfileButtonClasses,
  ProfileCard,
  secondaryProfileButtonClasses,
} from "./ProfileFoundation"

const AUTO_HINT_OPTIONS = [
  {
    description:
      "Show the three Piece Hints and their three Move Hints automatically.",
    mode: "auto-move-hints",
  },
  {
    description:
      "Show the three Piece Hints automatically, then leave Move Hints in your control.",
    mode: "auto-piece-hints",
  },
  {
    description:
      "Wait until you request Piece Hints or Move Hints during the match.",
    mode: "no-auto-hints",
  },
] as const satisfies readonly Readonly<{
  description: string
  mode: AutoHintMode
}>[]

export type ProfileSettingsPanelProps = Readonly<{
  activityMessage: string | null
  autoHintMode: AutoHintMode
  importIssue: ProfileImportIssue | null
  onAutoHintModeChanged: (autoHintMode: AutoHintMode) => void
  onBackupRead: (rawBackup: string) => void
  onClose: () => void
  onExportPlayerData: () => void
}>

export default function ProfileSettingsPanel({
  activityMessage,
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
          <legend className="px-2 font-black text-[var(--mapachito-charcoal)]">
            Better Hints
          </legend>
          <p className="mapachess-muted mb-4 text-sm">
            Choose how Better Hints appear automatically. During a match,
            changes take effect immediately and become the default for future
            matches. Every Better Hint remains available manually.
          </p>
          <div className="grid gap-3">
            {AUTO_HINT_OPTIONS.map(({ description, mode }) => (
              <label
                className="flex min-h-12 cursor-pointer items-start gap-4"
                key={mode}
              >
                <input
                  checked={autoHintMode === mode}
                  className="mapachess-checkbox mt-1"
                  disabled={busy}
                  name="auto-hint-mode"
                  onChange={() => onAutoHintModeChanged(mode)}
                  type="radio"
                  value={mode}
                />
                <span>
                  <span className="block font-black text-[var(--mapachito-charcoal)]">
                    {AUTO_HINT_MODE_LABELS[mode]}
                  </span>
                  <span className="mapachess-muted mt-1 block text-sm">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </div>
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

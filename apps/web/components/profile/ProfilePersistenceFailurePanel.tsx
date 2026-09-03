"use client"

import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { ProfilePersistenceFailure } from "@mapachess/profile/profile-machine"
import {
  persistenceFailureMessage,
  primaryProfileButtonClasses,
  ProfileCard,
  secondaryProfileButtonClasses,
} from "./ProfileFoundation"

export type ProfilePersistenceFailurePanelProps = Readonly<{
  exportablePlayerData: MapachessPlayerData | null
  failure: ProfilePersistenceFailure
  onExportPlayerData: () => void
  onExportUnreadable: (() => void) | null
  onRetry: () => void
}>

export default function ProfilePersistenceFailurePanel({
  exportablePlayerData,
  failure,
  onExportPlayerData,
  onExportUnreadable,
  onRetry,
}: ProfilePersistenceFailurePanelProps) {
  return (
    <div className="relative z-30 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)]">
      <ProfileCard labelledBy="profile-persistence-failure-title">
        <p className="mapachess-eyebrow">Local save paused</p>
        <h2
          className="mapachess-section-title mt-3"
          id="profile-persistence-failure-title"
        >
          This change was not marked saved.
        </h2>
        <p
          className="mapachess-notice mapachess-notice--warning mt-5 text-sm"
          role="alert"
        >
          {persistenceFailureMessage(failure)} Later state-changing actions are
          frozen until Retry succeeds.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            autoFocus
            className={primaryProfileButtonClasses}
            onClick={onRetry}
            type="button"
          >
            Retry Save
          </button>
          {exportablePlayerData === null ? null : (
            <button
              className={secondaryProfileButtonClasses}
              onClick={onExportPlayerData}
              type="button"
            >
              Export Pending Player Data
            </button>
          )}
          {onExportUnreadable === null ? null : (
            <button
              className={secondaryProfileButtonClasses}
              onClick={onExportUnreadable}
              type="button"
            >
              Export Unreadable Data
            </button>
          )}
        </div>
      </ProfileCard>
    </div>
  )
}

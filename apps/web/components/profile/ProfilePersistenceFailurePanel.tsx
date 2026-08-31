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
    <div className="relative z-20 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1rem,3vw,2rem)]">
      <ProfileCard labelledBy="profile-persistence-failure-title">
        <p className="font-mono text-xs font-bold tracking-[0.2em] text-amber-200 uppercase">
          Local save paused
        </p>
        <h2
          className="mt-2 text-3xl font-black tracking-[-0.035em] text-white"
          id="profile-persistence-failure-title"
        >
          This change was not marked saved.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300" role="alert">
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

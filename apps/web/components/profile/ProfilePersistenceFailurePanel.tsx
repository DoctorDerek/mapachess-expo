"use client"

import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { ProfilePersistenceFailure } from "@mapachess/profile/profile-machine"
import LocalSaveError from "../presentation/LocalSaveError"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import {
  persistenceFailureMessage,
  PREPARING_BACKUP_LABEL,
  ProfileCard,
} from "./ProfileFoundation"

export type ProfilePersistenceFailurePanelProps = Readonly<{
  exportablePlayerData: MapachessPlayerData | null
  exporting?: boolean
  retrying?: boolean
  failure: ProfilePersistenceFailure
  onExportPlayerData: () => void
  onExportUnreadable: (() => void) | null
  onRetry: () => void
}>

export default function ProfilePersistenceFailurePanel({
  exportablePlayerData,
  exporting = false,
  retrying = false,
  failure,
  onExportPlayerData,
  onExportUnreadable,
  onRetry,
}: ProfilePersistenceFailurePanelProps) {
  return (
    <div className="relative z-30 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)]">
      <ProfileCard labelledBy="profile-persistence-failure-title">
        <h2
          className="font-display text-mapachito-charcoal mt-3 text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance"
          id="profile-persistence-failure-title"
        >
          <LocalSaveError />
        </h2>
        <MapachessNotice tone="warning" className="mt-5 text-sm" role="alert">
          {persistenceFailureMessage(failure)} It is not yet saved. Later
          state-changing actions are frozen until Retry succeeds.
        </MapachessNotice>
        <div className="mt-6 flex flex-wrap gap-3">
          <MapachessButton
            aria-busy={retrying}
            autoFocus
            busyLabel="Retrying save…"
            onClick={onRetry}
            type="button"
          >
            Retry save
          </MapachessButton>
          {exportablePlayerData === null ? null : (
            <MapachessButton
              aria-busy={exporting}
              busyLabel={PREPARING_BACKUP_LABEL}
              variant="secondary"
              onClick={onExportPlayerData}
              type="button"
            >
              Export Pending Player Data
            </MapachessButton>
          )}
          {onExportUnreadable === null ? null : (
            <MapachessButton
              variant="secondary"
              onClick={onExportUnreadable}
              type="button"
            >
              Export Unreadable Data
            </MapachessButton>
          )}
        </div>
      </ProfileCard>
    </div>
  )
}

"use client"

import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { ProfilePersistenceFailure } from "@mapachess/profile/profile-machine"
import LocalSaveError from "../presentation/LocalSaveError"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import { persistenceFailureMessage, ProfileCard } from "./ProfileFoundation"

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
  const copy = useMapachessCopy()
  const messages = copy.interface.profilePersistenceFailurePanel

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
          {persistenceFailureMessage(failure, copy.profile)}{" "}
          {messages.itIsNotYetSavedLaterState}
        </MapachessNotice>
        <div className="mt-6 flex flex-wrap gap-3">
          <MapachessButton
            aria-busy={retrying}
            autoFocus
            busyLabel={messages.retryingSave}
            onClick={onRetry}
            type="button"
          >
            {messages.retrySave}
          </MapachessButton>
          {exportablePlayerData === null ? null : (
            <MapachessButton
              aria-busy={exporting}
              busyLabel={copy.profile.preparingBackup}
              variant="secondary"
              onClick={onExportPlayerData}
              type="button"
            >
              {messages.exportPendingPlayerData}
            </MapachessButton>
          )}
          {onExportUnreadable === null ? null : (
            <MapachessButton
              variant="secondary"
              onClick={onExportUnreadable}
              type="button"
            >
              {messages.exportUnreadableData}
            </MapachessButton>
          )}
        </div>
      </ProfileCard>
    </div>
  )
}

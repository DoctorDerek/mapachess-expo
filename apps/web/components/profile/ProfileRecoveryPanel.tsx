"use client"

import { useState } from "react"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import MapachessNotice from "../presentation/MapachessNotice"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import FullPageProfilePanel, {
  ImportBackupButton,
  importIssueMessage,
} from "./ProfileFoundation"
import SettingsView from "./SettingsView"

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
  const copy = useMapachessCopy()
  const messages = copy.interface.profileRecoveryPanel

  const [confirmingReset, setConfirmingReset] = useState(false)
  const cancelReset = (): void => {
    setConfirmingReset(false)
  }

  return (
    <FullPageProfilePanel
      description={messages.mapachessCouldNotSafelyReadTheCurrent}
      eyebrow={messages.localDataRecovery}
      live="assertive"
      title={messages.yourSaveNeedsAttention}
      actions={
        <MapachessButton className="w-full" onClick={onTryAgain}>
          {messages.tryAgain}
        </MapachessButton>
      }
    >
      {downloadFailed ? (
        <MapachessNotice tone="warning" className="mt-6 text-sm" role="alert">
          {messages.theDownloadCouldNotBeCreatedYour}
        </MapachessNotice>
      ) : null}
      {importIssue === null ? null : (
        <MapachessNotice tone="warning" className="mt-6 text-sm" role="alert">
          {importIssueMessage(importIssue, copy.profile)}
        </MapachessNotice>
      )}

      {confirmingReset ? (
        <MapachessDialog
          label={messages.resetAllLocalPlayerData}
          onClose={cancelReset}
          fixedContent
        >
          <SettingsView
            title={messages.resetAllLocalPlayerData}
            closeLabel={messages.cancel}
            onClose={cancelReset}
            actions={
              <MapachessButton variant="destructive" onClick={onResetConfirmed}>
                {messages.resetAllLocalPlayerData2}
              </MapachessButton>
            }
          >
            <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
              {messages.thisReplacesAllLocalPlayerDataIncluding}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <MapachessButton
                variant="secondary"
                onClick={onExportUnreadable}
                type="button"
              >
                {messages.exportUnreadableData}
              </MapachessButton>
            </div>
          </SettingsView>
        </MapachessDialog>
      ) : null}
      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <MapachessButton
          variant="secondary"
          onClick={onExportUnreadable}
          type="button"
        >
          {messages.exportUnreadableData}
        </MapachessButton>
        <ImportBackupButton disabled={false} onBackupRead={onBackupRead} />
        {hasLastKnownGood ? (
          <MapachessButton
            variant="secondary"
            onClick={onRestoreLastKnownGood}
            type="button"
          >
            {messages.restoreLastKnownGoodSave}
          </MapachessButton>
        ) : null}
        <MapachessButton
          variant="destructive"
          onClick={() => setConfirmingReset(true)}
          type="button"
        >
          {messages.reviewFullLocalReset}
        </MapachessButton>
      </div>
    </FullPageProfilePanel>
  )
}

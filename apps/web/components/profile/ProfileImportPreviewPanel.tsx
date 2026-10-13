"use client"

import type { MapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { selectStoryCompletion } from "@mapachess/profile/story-progress"
import MapachessButton from "../presentation/MapachessButton"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import { ProfileCard } from "./ProfileFoundation"

export type ProfileImportPreviewPanelProps = Readonly<{
  backup: MapachessPortableBackup
  onCancel: () => void
  onConfirm: () => void
}>

export default function ProfileImportPreviewPanel({
  backup,
  onCancel,
  onConfirm,
}: ProfileImportPreviewPanelProps) {
  const copy = useMapachessCopy()
  const messages = copy.interface.profileImportPreviewPanel

  const data = backup.payload
  const completion = selectStoryCompletion(data.storyProgress)

  return (
    <div className="relative z-20 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)]">
      <ProfileCard labelledBy="profile-import-preview-title">
        <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
          {messages.verifiedBackupPreview}
        </p>
        <h2
          className="font-display text-mapachito-charcoal mt-3 text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase"
          id="profile-import-preview-title"
        >
          {messages.reviewBeforeReplacingLocalData}
        </h2>
        <p className="text-mapachito-charcoal mt-5 text-sm leading-[1.55] font-semibold opacity-76">
          {messages.theBackupPassedStructuralAndIntegrityChecks}
        </p>

        <dl className="border-mapachito-charcoal bg-mapachito-white shadow-mapachito-blue [&_dt]:text-mapachito-charcoal [&_dd]:text-mapachito-charcoal mt-7 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-5 text-sm shadow-[0.25rem_0.25rem_0] [&_dd]:font-extrabold [&_dt]:font-black [&_dt]:opacity-72">
          <dt>{messages.backupApplication}</dt>
          <dd className="text-right">{backup.applicationVersion}</dd>
          <dt>{messages.dataRevision}</dt>
          <dd className="text-right">{data.revision}</dd>
          <dt>{messages.automaticHints}</dt>
          <dd className="text-right">
            {copy.setup.autoHints[data.settings.autoHintMode].label}
          </dd>
          <dt>{messages.activeMatch}</dt>
          <dd className="text-right">
            {data.activeMatch === null
              ? copy.profile.none
              : copy.profile.included}
          </dd>
          <dt>{copy.profile.ratingLabel.standard}</dt>
          <dd className="text-right">{Math.round(data.ratings.standard)}</dd>
          <dt>{copy.profile.ratingLabel.chess960}</dt>
          <dd className="text-right">{Math.round(data.ratings.chess960)}</dd>
          <dt>{messages.earlierFourRatings}</dt>
          <dd className="text-right">{messages.preservedInBackup}</dd>
          <dt>{copy.shared.story.standard}</dt>
          <dd className="text-right">
            {copy.gameplay.storyCompletion(completion.standard)}
          </dd>
          <dt>{copy.shared.story.chess960}</dt>
          <dd className="text-right">
            {copy.gameplay.storyCompletion(completion.chess960)}
          </dd>
          <dt>{copy.shared.story.overall}</dt>
          <dd className="text-right">
            {copy.gameplay.storyCompletion(completion.overall)}
          </dd>
        </dl>

        <div className="mt-7 flex flex-wrap gap-3">
          <MapachessButton
            variant="secondary"
            autoFocus
            onClick={onCancel}
            type="button"
          >
            {messages.cancelImport}
          </MapachessButton>
          <MapachessButton onClick={onConfirm} type="button">
            {messages.replaceLocalPlayerData}
          </MapachessButton>
        </div>
      </ProfileCard>
    </div>
  )
}

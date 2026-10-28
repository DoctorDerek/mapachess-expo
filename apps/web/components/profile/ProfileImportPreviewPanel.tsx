"use client"

import type { MapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { PLAYER_RATING_CONTEXTS } from "@mapachess/profile/rating-context"
import { selectStoryCompletion } from "@mapachess/profile/story-progress"
import MapachessButton from "../presentation/MapachessButton"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import { ProfileCard } from "./ProfileFoundation"

export type ProfileImportPreviewPanelProps = Readonly<{
  backup: MapachessPortableBackup
  onCancel: () => void
  onConfirm: () => void
}>

function BackupFact({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <dt className="min-w-0 flex-1 basis-36 font-black wrap-break-word opacity-72">
        {label}
      </dt>
      <dd className="max-w-full min-w-0 text-right font-extrabold wrap-break-word">
        {value}
      </dd>
    </div>
  )
}

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
    <div className="bg-mapachito-charcoal fixed inset-0 z-50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ProfileCard
        labelledBy="profile-import-preview-title"
        className="h-full min-h-0 p-3!"
      >
        <ScrollActions
          actions={
            <div className="flex flex-wrap gap-3">
              <MapachessButton
                variant="secondary"
                autoFocus
                onClick={onCancel}
                type="button"
              >
                {messages.cancelImport}
              </MapachessButton>
              <MapachessButton
                variant="destructive"
                onClick={onConfirm}
                type="button"
              >
                {messages.replaceLocalPlayerData}
              </MapachessButton>
            </div>
          }
        >
          <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
            {messages.verifiedBackupPreview}
          </p>
          <h2
            className="font-display text-mapachito-charcoal mt-3 text-2xl leading-tight font-black text-balance wrap-break-word"
            id="profile-import-preview-title"
          >
            {messages.reviewBeforeReplacingLocalData}
          </h2>
          <p className="text-mapachito-charcoal mt-5 text-sm leading-[1.55] font-semibold opacity-76">
            {messages.theBackupPassedStructuralAndIntegrityChecks}
          </p>

          <dl className="text-mapachito-charcoal mt-5 grid min-w-0 gap-4 text-sm">
            <BackupFact
              label={messages.backupApplication}
              value={backup.applicationVersion}
            />
            <BackupFact label={messages.dataRevision} value={data.revision} />
            <BackupFact
              label={messages.automaticHints}
              value={copy.setup.autoHints[data.settings.autoHintMode].label}
            />
            <BackupFact
              label={messages.activeMatch}
              value={
                data.activeMatch === null
                  ? copy.profile.none
                  : copy.profile.included
              }
            />
            {PLAYER_RATING_CONTEXTS.map(
              ({ id, variant, category, assistance }) => (
                <BackupFact
                  key={id}
                  label={copy.gameplay.clock.rating(
                    copy.profile.ratingLabel[variant],
                    copy.gameplay.clock.category[category],
                    copy.shared.story.medals[assistance],
                  )}
                  value={Math.round(data.ratings[id])}
                />
              ),
            )}
            <BackupFact
              label={messages.earlierFourRatings}
              value={messages.preservedInBackup}
            />
            <BackupFact
              label={copy.shared.story.standard}
              value={copy.gameplay.storyCompletion(completion.standard)}
            />
            <BackupFact
              label={copy.shared.story.chess960}
              value={copy.gameplay.storyCompletion(completion.chess960)}
            />
            <BackupFact
              label={copy.shared.story.overall}
              value={copy.gameplay.storyCompletion(completion.overall)}
            />
          </dl>
        </ScrollActions>
      </ProfileCard>
    </div>
  )
}

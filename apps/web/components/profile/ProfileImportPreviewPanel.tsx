"use client"

import type { MapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { autoHintModeLabel } from "../../lib/profile/autoHintModePresentation"
import MapachessButton from "../presentation/MapachessButton"
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
  const data = backup.payload

  return (
    <div className="relative z-20 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)]">
      <ProfileCard labelledBy="profile-import-preview-title">
        <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
          Verified backup preview
        </p>
        <h2
          className="font-display text-mapachito-charcoal mt-3 text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase"
          id="profile-import-preview-title"
        >
          Review before replacing local data
        </h2>
        <p className="text-mapachito-charcoal mt-5 text-sm leading-[1.55] font-semibold opacity-76">
          The backup passed structural and integrity checks. Nothing has been
          replaced yet. Confirming first creates and verifies a backup of the
          current readable profile when one exists.
        </p>

        <dl className="border-mapachito-charcoal bg-mapachito-white shadow-mapachito-blue [&_dt]:text-mapachito-charcoal [&_dd]:text-mapachito-charcoal mt-7 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-5 text-sm shadow-[0.25rem_0.25rem_0] [&_dd]:font-extrabold [&_dt]:font-black [&_dt]:opacity-72">
          <dt>Backup application</dt>
          <dd className="text-right">{backup.applicationVersion}</dd>
          <dt>Data revision</dt>
          <dd className="text-right">{data.revision}</dd>
          <dt>Automatic hints</dt>
          <dd className="text-right">
            {autoHintModeLabel(data.settings.autoHintMode)}
          </dd>
          <dt>Active match</dt>
          <dd className="text-right">
            {data.activeMatch === null ? "None" : "Included"}
          </dd>
          <dt>Standard Story Elo</dt>
          <dd className="text-right">{data.ratings.standardStory}</dd>
          <dt>Standard Challenge Elo</dt>
          <dd className="text-right">{data.ratings.standardChallenge}</dd>
          <dt>Chess960 Story Elo</dt>
          <dd className="text-right">{data.ratings.chess960Story}</dd>
          <dt>Chess960 Challenge Elo</dt>
          <dd className="text-right">{data.ratings.chess960Challenge}</dd>
        </dl>

        <div className="mt-7 flex flex-wrap gap-3">
          <MapachessButton
            variant="secondary"
            autoFocus
            onClick={onCancel}
            type="button"
          >
            Cancel Import
          </MapachessButton>
          <MapachessButton onClick={onConfirm} type="button">
            Replace Local Player Data
          </MapachessButton>
        </div>
      </ProfileCard>
    </div>
  )
}

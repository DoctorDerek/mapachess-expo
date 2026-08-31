"use client"

import type { MapachessPortableBackup } from "@mapachess/profile/portable-backup"
import {
  primaryProfileButtonClasses,
  ProfileCard,
  secondaryProfileButtonClasses,
} from "./ProfileFoundation"

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
    <div className="relative z-10 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1rem,3vw,2rem)]">
      <ProfileCard labelledBy="profile-import-preview-title">
        <p className="font-mono text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase">
          Verified backup preview
        </p>
        <h2
          className="mt-2 text-3xl font-black tracking-[-0.035em] text-white"
          id="profile-import-preview-title"
        >
          Review before replacing local data
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          The backup passed structural and integrity checks. Nothing has been
          replaced yet. Confirming first creates and verifies a backup of the
          current readable profile when one exists.
        </p>

        <dl className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-slate-900/65 p-5 text-sm">
          <dt className="font-bold text-slate-400">Backup application</dt>
          <dd className="text-right text-slate-100">
            {backup.applicationVersion}
          </dd>
          <dt className="font-bold text-slate-400">Data revision</dt>
          <dd className="text-right text-slate-100">{data.revision}</dd>
          <dt className="font-bold text-slate-400">Auto-Hints</dt>
          <dd className="text-right text-slate-100">
            {data.settings.autoHintsEnabled ? "On" : "Off"}
          </dd>
          <dt className="font-bold text-slate-400">Active match</dt>
          <dd className="text-right text-slate-100">
            {data.activeMatch === null ? "None" : "Included"}
          </dd>
          <dt className="font-bold text-slate-400">Standard Story Elo</dt>
          <dd className="text-right text-slate-100">
            {data.ratings.standardStory}
          </dd>
          <dt className="font-bold text-slate-400">Standard Challenge Elo</dt>
          <dd className="text-right text-slate-100">
            {data.ratings.standardChallenge}
          </dd>
          <dt className="font-bold text-slate-400">Chess960 Story Elo</dt>
          <dd className="text-right text-slate-100">
            {data.ratings.chess960Story}
          </dd>
          <dt className="font-bold text-slate-400">Chess960 Challenge Elo</dt>
          <dd className="text-right text-slate-100">
            {data.ratings.chess960Challenge}
          </dd>
        </dl>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            autoFocus
            className={secondaryProfileButtonClasses}
            onClick={onCancel}
            type="button"
          >
            Cancel Import
          </button>
          <button
            className={primaryProfileButtonClasses}
            onClick={onConfirm}
            type="button"
          >
            Replace Local Player Data
          </button>
        </div>
      </ProfileCard>
    </div>
  )
}

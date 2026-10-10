"use client"

import type { CoachCollectionId } from "@mapachess/match-presentation/coach-portrait"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import { MATCH_SETUP_COPY } from "@mapachess/match/match-setup"
import { MATCH_VARIANT_LABELS } from "@mapachess/match/match-variant"
import type {
  ChessAppearanceChange,
  ChessAppearanceSettings,
} from "@mapachess/profile/chess-appearance-settings"
import {
  PLAYER_ELO_RATING_IDS,
  type PlayerEloRatingId,
  type PlayerEloRatings,
  type RatedMatchCounts,
} from "@mapachess/profile/player-data"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import ArtCredits from "./ArtCredits"
import AutoHintModeChoices from "./AutoHintModeChoices"
import ChessAppearanceChoices from "./ChessAppearanceChoices"
import CoachCollectionChoices from "./CoachCollectionChoices"
import MoveClassificationFaq from "./MoveClassificationFaq"
import {
  ImportBackupButton,
  importIssueMessage,
  PREPARING_BACKUP_LABEL,
} from "./ProfileFoundation"

export const PROFILE_SETTINGS_TITLE = "Settings & Player Data"

export type ProfileSettingsPanelProps = Readonly<{
  activityMessage: string | null
  exporting?: boolean
  hintChangesDisabled?: boolean
  autoHintMode: AutoHintMode
  chessAppearance: ChessAppearanceSettings
  chessAppearanceDisabled: boolean
  coachCollection: CoachCollectionId
  onCoachCollectionChanged: (collection: CoachCollectionId) => void
  onChessAppearanceChanged: (change: ChessAppearanceChange) => void
  ratings: PlayerEloRatings
  ratedMatchCounts: RatedMatchCounts
  importIssue: ProfileImportIssue | null
  onAutoHintModeChanged: (autoHintMode: AutoHintMode) => void
  onBackupRead: (rawBackup: string) => void
  onClose: () => void
  onExportPlayerData: () => void
  onEloResetConfirmed: (variant: PlayerEloRatingId) => void
  overlays: readonly MatchNavigationOverlay[]
  navigation: MatchNavigationCommands
}>

export default function ProfileSettingsPanel({
  activityMessage,
  exporting = false,
  hintChangesDisabled,
  autoHintMode,
  chessAppearance,
  chessAppearanceDisabled,
  coachCollection,
  onCoachCollectionChanged,
  onChessAppearanceChanged,
  ratings,
  ratedMatchCounts,
  importIssue,
  onAutoHintModeChanged,
  onBackupRead,
  onClose,
  onExportPlayerData,
  onEloResetConfirmed,
  overlays,
  navigation,
}: ProfileSettingsPanelProps) {
  const busy = activityMessage !== null
  const resetOverlay = overlays.findLast(
    (overlay) => overlay === "reset-standard" || overlay === "reset-chess960",
  )
  const resetVariant =
    resetOverlay === "reset-standard"
      ? "standard"
      : resetOverlay === "reset-chess960"
        ? "chess960"
        : null
  const resetLabel =
    resetVariant === null ? "" : MATCH_VARIANT_LABELS[resetVariant]

  return (
    <div
      aria-busy={busy}
      className="mx-auto w-full max-w-3xl aria-busy:[&_button:disabled]:opacity-100 aria-busy:[&_label:has(:disabled)]:opacity-100"
      id="profile-settings-panel"
    >
      <header className="bg-mapachito-white sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 py-2">
        <h2
          className="font-display text-mapachito-charcoal text-2xl leading-tight font-black"
          id="profile-settings-title"
        >
          {PROFILE_SETTINGS_TITLE}
        </h2>
        <MapachessButton
          variant="secondary"
          autoFocus
          onClick={onClose}
          type="button"
        >
          Close Settings
        </MapachessButton>
      </header>

      <div className="mt-8">
        <p className="text-mapachito-charcoal mb-4 text-sm leading-[1.55] font-semibold opacity-76">
          Choose how Better Hints appear automatically. During a match, changes
          take effect immediately and become the default for future matches.
          Every Better Hint remains available manually.
        </p>
        <AutoHintModeChoices
          autoHintMode={autoHintMode}
          disabled={hintChangesDisabled ?? busy}
          onAutoHintModeChanged={onAutoHintModeChanged}
        />
      </div>

      <CoachCollectionChoices
        collection={coachCollection}
        disabled={chessAppearanceDisabled}
        onChange={onCoachCollectionChanged}
      />

      <ChessAppearanceChoices
        appearance={chessAppearance}
        disabled={chessAppearanceDisabled}
        onChange={onChessAppearanceChanged}
      />

      <section aria-labelledby="player-elo-settings-title" className="mt-7">
        <h2
          className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
          id="player-elo-settings-title"
        >
          Your Elo ratings
        </h2>
        <div className="mt-4 grid gap-3">
          {PLAYER_ELO_RATING_IDS.map((variant) => {
            const label = MATCH_VARIANT_LABELS[variant]
            return (
              <div
                className="border-mapachito-charcoal flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 p-3"
                key={variant}
              >
                <div>
                  <p className="text-mapachito-charcoal font-bold">
                    {label} · {Math.round(ratings[variant])} Elo
                  </p>
                  <p className="text-mapachito-charcoal text-sm opacity-76">
                    {ratedMatchCounts[variant]} rated matches
                  </p>
                </div>
                <MapachessButton
                  disabled={busy}
                  onClick={() => navigation.open(`reset-${variant}`)}
                  type="button"
                  variant="secondary"
                >
                  Reset {label} Elo
                </MapachessButton>
              </div>
            )
          })}
        </div>
        {resetVariant === null ? null : (
          <div
            aria-labelledby="player-elo-reset-title"
            className="border-mapachito-charcoal bg-mapachito-white mt-4 rounded-lg border-3 p-4"
            role="group"
          >
            <h3
              className="text-mapachito-charcoal text-lg font-black"
              id="player-elo-reset-title"
            >
              Reset {resetLabel} Elo?
            </h3>
            <p className="text-mapachito-charcoal mt-2 text-base leading-relaxed">
              {resetLabel} Elo returns to 100 and its rated-match count to zero.
              The other rating, Story progress, medals, Challenge records,
              settings, and active match stay unchanged. Completed matches
              cannot be rated again. Export your data first if you want a
              backup.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <MapachessButton
                autoFocus
                onClick={navigation.back}
                type="button"
                variant="secondary"
              >
                Cancel
              </MapachessButton>
              <MapachessButton
                aria-busy={exporting}
                busyLabel={PREPARING_BACKUP_LABEL}
                onClick={onExportPlayerData}
                type="button"
                variant="secondary"
              >
                Export Player Data
              </MapachessButton>
              <MapachessButton
                disabled={busy}
                onClick={() => {
                  onEloResetConfirmed(resetVariant)
                  navigation.back()
                }}
                type="button"
                variant="destructive"
              >
                Reset {resetLabel} Elo to 100
              </MapachessButton>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="player-data-actions-title" className="mt-7">
        <h2
          className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
          id="player-data-actions-title"
        >
          Portable Player Data
        </h2>
        <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
          Data stays on this device unless you explicitly download or import a
          JSON backup. Import first opens a non-destructive preview and is never
          applied before you review it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <MapachessButton
            aria-busy={exporting}
            busyLabel={PREPARING_BACKUP_LABEL}
            onClick={onExportPlayerData}
            type="button"
          >
            Export Player Data
          </MapachessButton>
          <ImportBackupButton disabled={busy} onBackupRead={onBackupRead} />
        </div>
      </section>

      <MoveClassificationFaq
        open={overlays.includes("classifications")}
        onOpen={() => navigation.open("classifications")}
        onClose={navigation.back}
      />
      <details
        open={overlays.includes("about-elo")}
        className="text-mapachito-charcoal mt-7 text-base"
      >
        <summary
          onClick={(event) => {
            event.preventDefault()
            if (overlays.includes("about-elo")) navigation.back()
            else navigation.open("about-elo")
          }}
          className="min-h-12 cursor-pointer content-center rounded-lg font-bold focus-visible:outline-2"
        >
          About Elo ratings
        </summary>
        <p>{MATCH_SETUP_COPY.webCalibrationDifficulty}</p>
      </details>

      <ArtCredits
        open={overlays.includes("credits")}
        onOpen={() => navigation.open("credits")}
        onClose={navigation.back}
      />

      {importIssue === null ? null : (
        <MapachessNotice tone="warning" className="mt-5 text-sm" role="alert">
          {importIssueMessage(importIssue)}
        </MapachessNotice>
      )}
      {activityMessage === null ? null : (
        <p className="sr-only" role="status">
          {activityMessage}
        </p>
      )}
    </div>
  )
}

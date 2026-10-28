"use client"

import { useState } from "react"
import type { ShippedLocale } from "@mapachess/localization/locale"
import type { CoachCollectionId } from "@mapachess/match-presentation/coach-portrait"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import type { PlayerInputBindings } from "@mapachess/match/player-input"
import { type TimeCategory } from "@mapachess/match/time-control"
import type {
  ChessAppearanceChange,
  ChessAppearanceSettings,
} from "@mapachess/profile/chess-appearance-settings"
import {
  type PlayerEloRatingId,
  type PlayerEloRatings,
  type RatedMatchCounts,
} from "@mapachess/profile/player-data"
import type { MoveReactionPlacement } from "@mapachess/profile/presentation-preferences"
import type { ProfileImportIssue } from "@mapachess/profile/profile-machine"
import { PLAYER_RATING_CONTEXTS } from "@mapachess/profile/rating-context"
import { TimeCategoryChoices } from "../gameplay/TimeControlChoices"
import InputBindingSettings from "../input/InputBindingSettings"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import MapachessNotice from "../presentation/MapachessNotice"
import ArtCredits from "./ArtCredits"
import AutoHintModeChoices from "./AutoHintModeChoices"
import AutoHintsHelp from "./AutoHintsHelp"
import ChessAppearanceChoices from "./ChessAppearanceChoices"
import CoachCollectionChoices from "./CoachCollectionChoices"
import LanguageChoice from "./LanguageChoice"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import MoveClassificationFaq from "./MoveClassificationFaq"
import MoveReactionPlacementChoices from "./MoveReactionPlacementChoices"
import { ImportBackupButton, importIssueMessage } from "./ProfileFoundation"
import SettingsView from "./SettingsView"

export type ProfileSettingsPanelProps = Readonly<{
  activityMessage: string | null
  locale: ShippedLocale
  onLocaleChanged: (locale: ShippedLocale) => void
  inputBindings: PlayerInputBindings
  onInputBindingsSaved: (bindings: PlayerInputBindings) => void
  exporting?: boolean
  hintChangesDisabled?: boolean
  autoHintMode: AutoHintMode
  chessAppearance: ChessAppearanceSettings
  presentationPreferencesDisabled: boolean
  coachCollection: CoachCollectionId
  moveReactionPlacement: MoveReactionPlacement
  onMoveReactionPlacementChanged: (placement: MoveReactionPlacement) => void
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
  locale,
  onLocaleChanged,
  inputBindings,
  onInputBindingsSaved,
  exporting = false,
  hintChangesDisabled,
  autoHintMode,
  chessAppearance,
  presentationPreferencesDisabled,
  coachCollection,
  moveReactionPlacement,
  onMoveReactionPlacementChanged,
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
  const copy = useMapachessCopy()
  const messages = copy.interface.profileSettingsPanel

  const busy = activityMessage !== null
  const activeView = overlays.at(-1)
  const informationOpen =
    activeView === "credits" || activeView === "auto-hints-help"
  const [ratingCategory, setRatingCategory] = useState<TimeCategory>("untimed")
  const resetContext = PLAYER_RATING_CONTEXTS.find(({ id }) =>
    overlays.includes(`reset-${id}`),
  )
  const resetVariant = resetContext?.id ?? null
  const resetLabel =
    resetContext === undefined
      ? ""
      : copy.gameplay.clock.rating(
          copy.setup.variants[resetContext.variant],
          copy.gameplay.clock.category[resetContext.category],
          copy.shared.story.medals[resetContext.assistance],
        )

  return (
    <div
      aria-busy={busy}
      className="mx-auto h-full w-full max-w-3xl wrap-anywhere aria-busy:[&_button:disabled]:opacity-100 aria-busy:[&_label:has(:disabled)]:opacity-100"
      id="profile-settings-panel"
    >
      <SettingsView
        title={copy.profile.settingsTitle}
        closeLabel={copy.shared.settingsControls.close}
        closeAccessibleLabel={messages.closeSettings}
        onClose={onClose}
        hidden={informationOpen}
      >
        <div className="mt-5 grid gap-3">
          <LanguageChoice
            locale={locale}
            disabled={busy}
            onChange={onLocaleChanged}
          />
          <CoachCollectionChoices
            open={overlays.includes("settings-coach")}
            onToggle={() =>
              overlays.includes("settings-coach")
                ? navigation.back()
                : navigation.open("settings-coach")
            }
            collection={coachCollection}
            disabled={presentationPreferencesDisabled}
            onChange={onCoachCollectionChanged}
          />
          <ChessAppearanceChoices
            open={
              overlays.includes("settings-pieces")
                ? "pieces"
                : overlays.includes("settings-board")
                  ? "board"
                  : null
            }
            onOpen={(choice) => navigation.open(`settings-${choice}`)}
            onClose={navigation.back}
            appearance={chessAppearance}
            disabled={presentationPreferencesDisabled}
            onChange={onChessAppearanceChanged}
          />
        </div>

        <div className="mt-7">
          <p className="text-mapachito-charcoal mb-4 text-sm leading-[1.55] font-semibold opacity-76">
            {messages.hintChangesTakeEffectImmediatelyAndBecome}
          </p>
          <AutoHintModeChoices
            autoHintMode={autoHintMode}
            disabled={hintChangesDisabled ?? busy}
            onAutoHintModeChanged={onAutoHintModeChanged}
            onExplain={() => navigation.open("auto-hints-help")}
          />
        </div>

        <MoveReactionPlacementChoices
          placement={moveReactionPlacement}
          disabled={presentationPreferencesDisabled}
          onChange={onMoveReactionPlacementChanged}
        />

        <InputBindingSettings
          overlays={overlays}
          navigation={navigation}
          bindings={inputBindings}
          disabled={busy}
          onSave={onInputBindingsSaved}
        />

        <section aria-labelledby="player-elo-settings-title" className="mt-7">
          <h2
            className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
            id="player-elo-settings-title"
          >
            {messages.yourEloRatings}
          </h2>
          <div className="mt-3">
            <TimeCategoryChoices
              category={ratingCategory}
              disabled={resetContext !== undefined || busy}
              onChange={setRatingCategory}
            />
          </div>
          <div className="mt-4 grid gap-3">
            {PLAYER_RATING_CONTEXTS.filter(
              ({ category }) => category === ratingCategory,
            ).map(
              ({
                id: variant,
                variant: chessVariant,
                category,
                assistance,
              }) => {
                const label = copy.gameplay.clock.rating(
                  copy.setup.variants[chessVariant],
                  copy.gameplay.clock.category[category],
                  copy.shared.story.medals[assistance],
                )
                return (
                  <div
                    className="border-mapachito-charcoal flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 p-3"
                    key={variant}
                  >
                    <div>
                      <p className="text-mapachito-charcoal font-bold">
                        {copy.profile.rating(label, ratings[variant])}
                      </p>
                      <p className="text-mapachito-charcoal text-sm opacity-76">
                        {copy.profile.ratedMatches(ratedMatchCounts[variant])}
                      </p>
                    </div>
                    <MapachessButton
                      aria-label={copy.profile.resetRating(label)}
                      className="px-3! py-2! text-base"
                      disabled={busy}
                      onClick={() => navigation.open(`reset-${variant}`)}
                      type="button"
                      variant="secondary"
                    >
                      {copy.profile.resetAction}
                    </MapachessButton>
                  </div>
                )
              },
            )}
          </div>
          {resetVariant === null ? null : (
            <MapachessDialog
              label={copy.profile.resetQuestion(resetLabel)}
              onClose={navigation.back}
              fixedContent
            >
              <SettingsView
                title={copy.profile.resetQuestion(resetLabel)}
                closeLabel={messages.cancel}
                onClose={navigation.back}
                actions={
                  <MapachessButton
                    aria-label={copy.profile.resetConfirmation(resetLabel)}
                    disabled={busy}
                    onClick={() => {
                      onEloResetConfirmed(resetVariant)
                      navigation.back()
                    }}
                    variant="destructive"
                  >
                    {copy.profile.resetSubmit}
                  </MapachessButton>
                }
              >
                <p className="mt-4 text-base leading-relaxed">
                  {copy.profile.resetExplanation(resetLabel)}
                </p>
                <MapachessButton
                  className="mt-4"
                  aria-busy={exporting}
                  busyLabel={copy.profile.preparingBackup}
                  onClick={onExportPlayerData}
                  variant="secondary"
                >
                  {messages.exportPlayerData}
                </MapachessButton>
              </SettingsView>
            </MapachessDialog>
          )}
        </section>

        <section aria-labelledby="player-data-actions-title" className="mt-7">
          <h2
            className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black tracking-[0.015em] uppercase"
            id="player-data-actions-title"
          >
            {messages.portablePlayerData}
          </h2>
          <p className="text-mapachito-charcoal mt-3 text-sm leading-[1.55] font-semibold opacity-76">
            {messages.dataStaysOnThisDeviceUnlessYou}
          </p>
          {importIssue === null ? null : (
            <MapachessNotice
              tone="warning"
              className="mt-4 text-sm"
              role="alert"
            >
              {importIssueMessage(importIssue, copy.profile)}
            </MapachessNotice>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <MapachessButton
              aria-busy={exporting}
              busyLabel={copy.profile.preparingBackup}
              onClick={onExportPlayerData}
              type="button"
            >
              {messages.exportPlayerData}
            </MapachessButton>
            <ImportBackupButton disabled={busy} onBackupRead={onBackupRead} />
          </div>
        </section>

        <MoveClassificationFaq
          open={overlays.includes("classifications")}
          onOpen={() => navigation.open("classifications")}
          onClose={navigation.back}
        />

        <MapachessButton
          className="mt-7"
          variant="secondary"
          onClick={() => navigation.open("about-elo")}
        >
          {messages.aboutEloRatings}
        </MapachessButton>
        {overlays.includes("about-elo") ? (
          <MapachessDialog
            label={messages.aboutEloRatings}
            onClose={navigation.back}
            fixedContent
          >
            <SettingsView
              title={messages.aboutEloRatings}
              closeLabel={copy.shared.settingsControls.back}
              onClose={navigation.back}
              focusHeading
            >
              <p className="mt-4">{copy.setup.webCalibrationDifficulty}</p>
            </SettingsView>
          </MapachessDialog>
        ) : null}

        <div className="mt-7">
          <MapachessButton
            onClick={() => navigation.open("credits")}
            variant="secondary"
          >
            {copy.shared.creditControls.title}
          </MapachessButton>
        </div>

        {activityMessage === null ? null : (
          <p className="sr-only" role="status">
            {activityMessage}
          </p>
        )}
      </SettingsView>
      {activeView === "credits" ? (
        <ArtCredits onClose={navigation.back} />
      ) : null}
      {activeView === "auto-hints-help" ? (
        <AutoHintsHelp onClose={navigation.back} />
      ) : null}
    </div>
  )
}

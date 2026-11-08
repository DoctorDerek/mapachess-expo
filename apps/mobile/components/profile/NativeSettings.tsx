import { useState } from "react"
import { View } from "react-native"
import { MOVE_CLASSIFICATION_THRESHOLDS } from "@mapachess/evaluation/move-classification"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import { COACH_COLLECTION_IDS } from "@mapachess/match-presentation/coach-portrait"
import {
  AUTO_HINT_MODES,
  type AutoHintMode,
} from "@mapachess/match/auto-hint-mode"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import {
  TIME_CATEGORIES,
  type TimeCategory,
} from "@mapachess/match/time-control"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { MOVE_REACTION_PLACEMENTS } from "@mapachess/profile/presentation-preferences"
import { selectImportIssue } from "@mapachess/profile/profile-machine"
import { importIssueMessage } from "@mapachess/profile/profile-messages"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import { PLAYER_RATING_CONTEXTS } from "@mapachess/profile/rating-context"
import type useNativeFileActions from "@/lib/profile/useNativeFileActions"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeChessPiece from "../gameplay/NativeChessPiece"
import NativeInputBindingSettings from "../input/NativeInputBindingSettings"
import NativeButton from "../presentation/NativeButton"
import NativeChoicePanel from "../presentation/NativeChoicePanel"
import NativeImage from "../presentation/NativeImage"
import NativeMedal from "../presentation/NativeMedal"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import NativeAutoHintsHelp from "./NativeAutoHintsHelp"
import NativeCoachPortrait from "./NativeCoachPortrait"
import NativeCredits from "./NativeCredits"
import NativeLanguageChoices from "./NativeLanguageChoices"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeSettings({
  actor,
  data,
  files,
  disabled,
  navigation,
  overlay,
  autoHintMode = data.settings.autoHintMode,
  onAutoHintModeChanged,
}: Readonly<{
  actor: ProfileActor
  data: MapachessPlayerData
  files: ReturnType<typeof useNativeFileActions>
  disabled: boolean
  navigation: MatchNavigationCommands
  overlay: MatchNavigationOverlay | undefined
  autoHintMode?: AutoHintMode
  onAutoHintModeChanged: (mode: AutoHintMode) => void
}>) {
  const { copy } = useNativeLocale()
  const profileSnapshot = useActorSnapshot(actor)
  const importIssue = selectImportIssue(profileSnapshot)
  const [category, setCategory] = useState<TimeCategory>("untimed")
  const close = () => navigation.close("settings")
  if (overlay === "credits") return <NativeCredits onBack={navigation.back} />
  if (overlay === "auto-hints-help")
    return <NativeAutoHintsHelp onBack={navigation.back} />
  if (
    overlay === "settings-controls" ||
    overlay?.startsWith("control-binding-")
  )
    return (
      <NativeInputBindingSettings
        bindings={data.settings.inputBindings}
        onCancel={navigation.back}
        onSave={(bindings) => {
          navigation.back()
          actor.send({
            type: "PROFILE.INPUT_BINDINGS_SAVE_REQUESTED",
            bindings,
          })
        }}
      />
    )
  if (overlay === "settings-coach")
    return (
      <NativeChoicePanel
        title={copy.profile.customization.coach.label}
        value={data.settings.coachCollection}
        onCancel={navigation.back}
        choices={COACH_COLLECTION_IDS.map((value) => ({
          value,
          label: copy.profile.coachCollections[value],
          preview: <NativeCoachPortrait collection={value} label="neutral" />,
        }))}
        onAccept={(coachCollection) => {
          navigation.back()
          actor.send({
            type: "PROFILE.COACH_COLLECTION_CHANGED",
            coachCollection,
          })
        }}
      />
    )
  if (overlay === "settings-pieces")
    return (
      <NativeChoicePanel
        title={copy.profile.customization.pieces.label}
        value={data.settings.chessAppearance.pieceSetId}
        onCancel={navigation.back}
        choices={CHESS_PIECE_SETS.map(({ id }) => ({
          value: id,
          label: copy.artwork.pieces[id],
          preview: (
            <NativeChessPiece color="white" role="knight" pieceSetId={id} />
          ),
        }))}
        onAccept={(pieceSetId) => {
          navigation.back()
          actor.send({
            type: "PROFILE.CHESS_APPEARANCE_CHANGED",
            change: { pieceSetId },
          })
        }}
      />
    )
  if (overlay === "settings-board")
    return (
      <NativeChoicePanel
        title={copy.profile.customization.board.label}
        value={data.settings.chessAppearance.boardId}
        onCancel={navigation.back}
        choices={CHESS_BOARDS.map((board) => ({
          value: board.id,
          label: copy.artwork.boards[board.id],
          preview:
            board.kind === "colors" ? (
              <View className="size-14 flex-row">
                <View className="bg-mapachito-white flex-1" />
                <View className="bg-mapachito-blue flex-1" />
              </View>
            ) : (
              <NativeImage
                sourceId={`${board.delivery === "public" ? "/chess-assets" : "/generated/chess-assets"}/${board.image.path}`}
                className="h-full w-full"
              />
            ),
        }))}
        onAccept={(boardId) => {
          navigation.back()
          actor.send({
            type: "PROFILE.CHESS_APPEARANCE_CHANGED",
            change: { boardId },
          })
        }}
      />
    )
  const reset = PLAYER_RATING_CONTEXTS.find(
    ({ id }) => overlay === `reset-${id}`,
  )
  if (reset !== undefined) {
    const label = copy.gameplay.clock.rating(
      copy.setup.variants[reset.variant],
      copy.gameplay.clock.category[reset.category],
      copy.shared.story.medals[reset.assistance],
    )
    return (
      <NativePanel
        title={copy.profile.resetQuestion(label)}
        onBack={navigation.back}
        actions={
          <View className="flex-row gap-2">
            <NativeButton
              variant="secondary"
              className="flex-1"
              onPress={navigation.back}
            >
              {copy.setup.cancel}
            </NativeButton>
            <NativeButton
              variant="destructive"
              className="flex-1"
              disabled={disabled}
              onPress={() => {
                navigation.back()
                actor.send({
                  type: "PROFILE.ELO_RESET_CONFIRMED",
                  variant: reset.id,
                })
              }}
            >
              {copy.profile.resetSubmit}
            </NativeButton>
          </View>
        }
      >
        <NativeText>{copy.profile.resetExplanation(label)}</NativeText>
        <NativeButton
          disabled={files.status === "busy"}
          onPress={() => {
            void files.exportData()
          }}
        >
          {copy.interface.profileSettingsPanel.exportPlayerData}
        </NativeButton>
      </NativePanel>
    )
  }
  if (overlay === "classifications")
    return (
      <NativePanel
        title={copy.interface.moveClassificationFaq.howAreMovesClassified}
        onBack={navigation.back}
        actions={
          <NativeButton variant="secondary" onPress={navigation.back}>
            {copy.shared.settingsControls.back}
          </NativeButton>
        }
      >
        {[
          ...copy.classification.table(MOVE_CLASSIFICATION_THRESHOLDS),
          ...copy.classification.mateTable(MOVE_CLASSIFICATION_THRESHOLDS),
        ].map(([title, description], index) => (
          <View key={index} className="gap-2">
            <NativeText className="font-native text-lg">{title}</NativeText>
            <NativeText>{description}</NativeText>
          </View>
        ))}
      </NativePanel>
    )
  if (overlay === "about-elo")
    return (
      <NativePanel
        title={copy.interface.profileSettingsPanel.aboutEloRatings}
        onBack={navigation.back}
        actions={
          <NativeButton variant="secondary" onPress={navigation.back}>
            {copy.shared.settingsControls.back}
          </NativeButton>
        }
      >
        <NativeText>{copy.setup.webCalibrationDifficulty}</NativeText>
      </NativePanel>
    )
  return (
    <NativePanel
      title={copy.profile.settingsTitle}
      onBack={navigation.back}
      actions={
        <NativeButton variant="secondary" onPress={close}>
          {copy.shared.settingsControls.close}
        </NativeButton>
      }
    >
      <NativeLanguageChoices
        disabled={disabled}
        onChange={(locale) =>
          actor.send({ type: "PROFILE.LOCALE_CHANGED", locale })
        }
      />
      <View className="flex-row items-center gap-3">
        <NativeCoachPortrait
          collection={data.settings.coachCollection}
          label="neutral"
        />
        <NativeButton
          variant="secondary"
          className="flex-1"
          disabled={disabled}
          onPress={() => navigation.open("settings-coach")}
        >
          {copy.profile.customization.coach.change}
        </NativeButton>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="size-14">
          <NativeChessPiece
            color="white"
            role="knight"
            pieceSetId={data.settings.chessAppearance.pieceSetId}
          />
        </View>
        <NativeButton
          variant="secondary"
          className="flex-1"
          disabled={disabled}
          onPress={() => navigation.open("settings-pieces")}
        >
          {copy.profile.customization.pieces.change}
        </NativeButton>
      </View>
      <NativeButton
        variant="secondary"
        disabled={disabled}
        onPress={() => navigation.open("settings-board")}
      >
        {copy.profile.customization.board.change}:{" "}
        {copy.artwork.boards[data.settings.chessAppearance.boardId]}
      </NativeButton>
      <NativeText className="font-native text-xl">
        {copy.shared.settingsControls.autoHints}
      </NativeText>
      {AUTO_HINT_MODES.map((mode) => (
        <NativeButton
          key={mode}
          disabled={disabled}
          variant={autoHintMode === mode ? "primary" : "secondary"}
          accessibilityState={{ selected: autoHintMode === mode }}
          onPress={() => onAutoHintModeChanged(mode)}
        >
          {copy.setup.autoHints[mode].label}
        </NativeButton>
      ))}
      <NativeButton
        variant="secondary"
        accessibilityLabel={copy.shared.settingsControls.explainAutoHints}
        onPress={() => navigation.open("auto-hints-help")}
      >
        ?
      </NativeButton>
      <NativeText className="font-native text-xl">
        {copy.profile.moveReactionPlacement.label}
      </NativeText>
      <NativeText>{copy.profile.moveReactionPlacement.description}</NativeText>
      <View className="flex-row flex-wrap gap-2">
        {MOVE_REACTION_PLACEMENTS.map((placement) => (
          <NativeButton
            key={placement}
            className="flex-1"
            disabled={disabled}
            variant={
              data.settings.moveReactionPlacement === placement
                ? "primary"
                : "secondary"
            }
            accessibilityState={{
              selected: data.settings.moveReactionPlacement === placement,
            }}
            onPress={() =>
              actor.send({
                type: "PROFILE.MOVE_REACTION_PLACEMENT_CHANGED",
                placement,
              })
            }
          >
            {copy.profile.moveReactionPlacement.options[placement]}
          </NativeButton>
        ))}
      </View>
      <NativeButton
        variant="secondary"
        onPress={() => navigation.open("settings-controls")}
      >
        {copy.interface.inputBindingSettings.controls}
      </NativeButton>
      <NativeText className="font-native text-xl">
        {copy.interface.profileSettingsPanel.yourEloRatings}
      </NativeText>
      <View className="flex-row flex-wrap gap-2">
        {TIME_CATEGORIES.map((value) => (
          <NativeButton
            key={value}
            className="min-w-28 flex-1"
            variant={category === value ? "primary" : "secondary"}
            accessibilityState={{ selected: category === value }}
            onPress={() => setCategory(value)}
          >
            {copy.gameplay.clock.category[value]}
          </NativeButton>
        ))}
      </View>
      {PLAYER_RATING_CONTEXTS.filter(
        (context) => context.category === category,
      ).map(({ id, variant, assistance }) => (
        <View className="bg-mapachito-surface gap-2 rounded-lg p-3" key={id}>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="min-w-32 flex-1">
              <NativeText className="font-native">
                {copy.profile.ratingLabel[variant]}
              </NativeText>
              <View className="flex-row items-center gap-1">
                <NativeMedal medal={assistance} />
                <NativeText>{copy.shared.story.medals[assistance]}</NativeText>
              </View>
            </View>
            <NativeText className="font-native text-2xl">
              {copy.gameplay.elo(data.ratings[id])}
            </NativeText>
          </View>
          <NativeText>
            {copy.profile.ratedMatches(data.ratedMatchCounts[id])}
          </NativeText>
          <NativeButton
            variant="secondary"
            disabled={disabled}
            onPress={() => navigation.open(`reset-${id}`)}
          >
            {copy.profile.resetAction}
          </NativeButton>
        </View>
      ))}
      <NativeText className="font-native text-xl">
        {copy.interface.profileSettingsPanel.portablePlayerData}
      </NativeText>
      <NativeText>
        {copy.interface.profileSettingsPanel.dataStaysOnThisDeviceUnlessYou}
      </NativeText>
      <NativeButton
        disabled={files.status === "busy"}
        onPress={() => {
          void files.exportData()
        }}
      >
        {copy.interface.profileSettingsPanel.exportPlayerData}
      </NativeButton>
      <NativeButton
        disabled={disabled || files.status === "busy"}
        variant="secondary"
        onPress={() => {
          void files.importData()
        }}
      >
        {copy.interface.profileFoundation.importBackup}
      </NativeButton>
      {files.status === "failed" ? (
        <NativeText accessibilityRole="alert">
          {copy.profile.shareFailed}
        </NativeText>
      ) : files.status === "too-large" ? (
        <NativeText accessibilityRole="alert">
          {copy.profile.fileTooLarge}
        </NativeText>
      ) : null}
      {importIssue === null ? null : (
        <NativeText accessibilityRole="alert">
          {importIssueMessage(importIssue, copy.profile)}
        </NativeText>
      )}
      <NativeButton
        variant="secondary"
        onPress={() => navigation.open("classifications")}
      >
        {copy.interface.moveClassificationFaq.howAreMovesClassified}
      </NativeButton>
      <NativeButton
        variant="secondary"
        onPress={() => navigation.open("about-elo")}
      >
        {copy.interface.profileSettingsPanel.aboutEloRatings}
      </NativeButton>
      <NativeButton
        variant="secondary"
        onPress={() => navigation.open("credits")}
      >
        {copy.shared.creditControls.title}
      </NativeButton>
    </NativePanel>
  )
}

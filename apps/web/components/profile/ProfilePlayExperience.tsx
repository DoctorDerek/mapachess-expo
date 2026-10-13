"use client"

import { useSelector } from "@xstate/react"
import { useRef } from "react"
import { preload } from "react-dom"
import type { ActorRefFrom } from "xstate"
import matchMachine, {
  selectAutoHintMode,
} from "@mapachess/match/match-machine"
import resolveLocale from "@mapachess/localization/locale"
import profileMachine, {
  selectCanChangeAutoHintMode,
  selectCanChangePresentationPreferences,
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import { STOCKFISH_18_WEB_WASM_ARTIFACT } from "@mapachess/stockfish/web-runtime-identity"
import useWebMatchSession from "../../lib/gameplay/useWebMatchSession"
import useWebNavigationHistory from "../../lib/gameplay/useWebNavigationHistory"
import type { WebMatchSessionActor } from "../../lib/gameplay/webMatchSessionMachine"
import CoachCollectionContext from "../../lib/presentation/CoachCollectionContext"
import ChessAppearanceProvider, {
  ChessArtworkRecovery,
} from "../gameplay/ChessArtwork"
import WebGame from "../gameplay/WebGame"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import MapachessLoadingSurface from "../presentation/MapachessLoadingSurface"
import RecoverableView from "../presentation/RecoverableView"
import ProfileCardJourney from "./ProfileCardJourney"
import ProfileSettingsPanel, {
  PROFILE_SETTINGS_TITLE,
  type ProfileSettingsPanelProps,
} from "./ProfileSettingsPanel"

export type ProfilePlayExperienceProps = Readonly<{
  profileActor: ActorRefFrom<typeof profileMachine>
  blocked: boolean
  settings: Omit<
    ProfileSettingsPanelProps,
    | "autoHintMode"
    | "chessAppearance"
    | "chessAppearanceDisabled"
    | "coachCollection"
    | "onCoachCollectionChanged"
    | "onChessAppearanceChanged"
    | "ratings"
    | "ratedMatchCounts"
    | "onAutoHintModeChanged"
    | "onClose"
    | "overlays"
    | "navigation"
    | "inputBindings"
    | "onInputBindingsSaved"
    | "locale"
    | "onLocaleChanged"
  >
}>

function MatchSettings({
  actor,
  ...props
}: ProfileSettingsPanelProps &
  Readonly<{ actor: ActorRefFrom<typeof matchMachine> }>) {
  const autoHintMode = useSelector(actor, selectAutoHintMode)
  return <ProfileSettingsPanel {...props} autoHintMode={autoHintMode} />
}

function ReadyPlayExperience({
  profileActor,
  actor,
  blocked,
  settings,
}: ProfilePlayExperienceProps & Readonly<{ actor: WebMatchSessionActor }>) {
  const snapshot = useSelector(actor, (current) => current)
  const profile = useSelector(profileActor, (current) => current)
  const navigation = useWebNavigationHistory(actor)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const gameSurface = useRef<HTMLDivElement>(null)
  usePlayerInputScope({
    root: gameSurface,
    enabled: !blocked,
    handle: (action) => {
      if (action !== "cancel") return false
      navigation.back()
      return true
    },
  })
  const settingsOpen =
    snapshot.context.overlays.includes("settings") && !blocked
  const personalOpen = snapshot.context.overlays.some(
    (overlay) => overlay === "dressing-room" || overlay === "profile-card",
  )
  const matchActor = snapshot.context.session?.actor ?? null
  const playerData = selectCurrentPlayerData(profile)
  if (playerData === null)
    throw new Error("Play requires accepted player data.")
  const settingsProps: ProfileSettingsPanelProps = {
    ...settings,
    locale: resolveLocale({
      selection: (selectPendingPlayerData(profile) ?? playerData).settings
        .locale,
      preferences: globalThis.navigator?.languages ?? [],
    }),
    onLocaleChanged: (locale) =>
      profileActor.send({ type: "PROFILE.LOCALE_CHANGED", locale }),
    inputBindings: playerData.settings.inputBindings,
    onInputBindingsSaved: (bindings) =>
      profileActor.send({
        type: "PROFILE.INPUT_BINDINGS_SAVE_REQUESTED",
        bindings,
      }),
    chessAppearance: (selectPendingPlayerData(profile) ?? playerData).settings
      .chessAppearance,
    chessAppearanceDisabled: !selectCanChangePresentationPreferences(profile),
    coachCollection: (selectPendingPlayerData(profile) ?? playerData).settings
      .coachCollection,
    onCoachCollectionChanged: (coachCollection) =>
      profileActor.send({
        type: "PROFILE.COACH_COLLECTION_CHANGED",
        coachCollection,
      }),
    onChessAppearanceChanged: (change) =>
      profileActor.send({ type: "PROFILE.CHESS_APPEARANCE_CHANGED", change }),
    autoHintMode: (selectPendingPlayerData(profile) ?? playerData).settings
      .autoHintMode,
    ratings: playerData.ratings,
    ratedMatchCounts: playerData.ratedMatchCounts,
    hintChangesDisabled:
      matchActor === null && !selectCanChangeAutoHintMode(profile),
    onClose: navigation.back,
    overlays: snapshot.context.overlays,
    navigation,
    onAutoHintModeChanged: (autoHintMode) => {
      if (matchActor !== null)
        matchActor.send({ type: "MATCH.AUTO_HINT_MODE_CHANGED", autoHintMode })
      else
        profileActor.send({
          type: "PROFILE.AUTO_HINT_MODE_CHANGED",
          autoHintMode,
        })
    },
  }
  return (
    <ChessAppearanceProvider appearance={settingsProps.chessAppearance}>
      <CoachCollectionContext value={settingsProps.coachCollection}>
        <ProfileCardJourney
          blocked={blocked}
          profileActor={profileActor}
          overlays={snapshot.context.overlays}
          navigation={navigation}
        />
        {settingsOpen ? (
          <MapachessDialog
            label={PROFILE_SETTINGS_TITLE}
            onClose={navigation.back}
          >
            <RecoverableView
              title="Settings could not be displayed."
              description="Your player data has not been reset. Try again or close Settings."
              actions={
                <MapachessButton onClick={navigation.back}>
                  Close Settings
                </MapachessButton>
              }
            >
              {matchActor === null ? (
                <ProfileSettingsPanel {...settingsProps} />
              ) : (
                <MatchSettings {...settingsProps} actor={matchActor} />
              )}
            </RecoverableView>
          </MapachessDialog>
        ) : null}
        <div ref={gameSurface} inert={blocked || settingsOpen || personalOpen}>
          {settingsOpen ? null : <ChessArtworkRecovery />}
          <RecoverableView
            title="This screen could not be displayed."
            description="Your player data is still held in memory. Try again without refreshing, or export it."
            actions={
              <MapachessButton
                disabled={settings.exporting}
                onClick={settings.onExportPlayerData}
              >
                Export player data
              </MapachessButton>
            }
          >
            <WebGame
              actor={actor}
              navigation={navigation}
              profileActor={profileActor}
              onSettingsRequested={() => {
                settingsButton.current?.focus({ preventScroll: true })
                navigation.open("settings")
              }}
              settingsButtonRef={settingsButton}
              settingsOpen={settingsOpen}
            />
          </RecoverableView>
        </div>
      </CoachCollectionContext>
    </ChessAppearanceProvider>
  )
}

export default function ProfilePlayExperience(
  props: ProfilePlayExperienceProps,
) {
  preload(`/stockfish-runtime/${STOCKFISH_18_WEB_WASM_ARTIFACT.fileName}`, {
    as: "fetch",
    crossOrigin: "anonymous",
    fetchPriority: "low",
    type: "application/wasm",
  })
  const actor = useWebMatchSession(props.profileActor)
  return actor === null ? (
    <MapachessLoadingSurface />
  ) : (
    <ReadyPlayExperience {...props} actor={actor} />
  )
}

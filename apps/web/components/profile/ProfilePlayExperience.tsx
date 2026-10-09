"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useRef } from "react"
import type { ActorRefFrom } from "xstate"
import matchMachine, {
  selectAutoHintMode,
} from "@mapachess/match/match-machine"
import profileMachine, {
  selectCanChangeAutoHintMode,
  selectCanChangeChessAppearance,
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import useWebMatchSession from "../../lib/gameplay/useWebMatchSession"
import useWebNavigationHistory from "../../lib/gameplay/useWebNavigationHistory"
import type { WebMatchSessionActor } from "../../lib/gameplay/webMatchSessionMachine"
import ChessAppearanceProvider from "../gameplay/ChessArtwork"
import WebGame from "../gameplay/WebGame"
import MapachessButton from "../presentation/MapachessButton"
import MapachessLoadingSurface from "../presentation/MapachessLoadingSurface"
import RecoverableView from "../presentation/RecoverableView"
import ProfileCardJourney from "./ProfileCardJourney"
import ProfileSettingsPanel, {
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
    | "onChessAppearanceChanged"
    | "ratings"
    | "ratedMatchCounts"
    | "onAutoHintModeChanged"
    | "onClose"
    | "overlays"
    | "navigation"
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
  const settingsOpen =
    snapshot.context.overlays.includes("settings") && !blocked
  const personalOpen = snapshot.context.overlays.some(
    (overlay) => overlay === "dressing-room" || overlay === "profile-card",
  )
  const matchActor = snapshot.context.session?.actor ?? null
  const playerData = selectCurrentPlayerData(profile)
  if (playerData === null)
    throw new Error("Play requires accepted player data.")
  useEffect(() => {
    const dismiss = (event: KeyboardEvent): void => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        blocked ||
        actor.getSnapshot().context.overlays.length === 0
      )
        return
      event.preventDefault()
      navigation.back()
    }
    window.addEventListener("keydown", dismiss)
    return () => window.removeEventListener("keydown", dismiss)
  }, [actor, blocked, navigation.back])
  const settingsProps: ProfileSettingsPanelProps = {
    ...settings,
    chessAppearance: (selectPendingPlayerData(profile) ?? playerData).settings
      .chessAppearance,
    chessAppearanceDisabled: !selectCanChangeChessAppearance(profile),
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
      <ProfileCardJourney
        blocked={blocked}
        profileActor={profileActor}
        overlays={snapshot.context.overlays}
        navigation={navigation}
      />
      {settingsOpen ? (
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
      ) : null}
      <div inert={blocked || settingsOpen || personalOpen}>
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
            onSettingsRequested={() => navigation.open("settings")}
            settingsButtonRef={settingsButton}
            settingsOpen={settingsOpen}
          />
        </RecoverableView>
      </div>
    </ChessAppearanceProvider>
  )
}

export default function ProfilePlayExperience(
  props: ProfilePlayExperienceProps,
) {
  const actor = useWebMatchSession(props.profileActor)
  return actor === null ? (
    <MapachessLoadingSurface />
  ) : (
    <ReadyPlayExperience {...props} actor={actor} />
  )
}

import type { Chess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchNavigationCommands } from "@mapachess/match/match-navigation"
import type {
  MatchSessionActor,
  MatchSessionIdentity,
  MatchSessionMachineSnapshot,
} from "@mapachess/match/match-session-machine"
import createMatchSetupForMode, {
  type MatchModeSelection,
} from "@mapachess/match/match-setup"
import type { TimeControl } from "@mapachess/match/time-control"
import { samePlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  selectCanChangeAutoHintMode,
  selectCanNavigateProfile,
  selectCurrentPlayerData,
  selectPendingPlayerData,
  type ProfileMachineSnapshot,
} from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import { selectDefaultStoryOpponent } from "@mapachess/profile/story-progress"

type HomeSession = MatchSessionIdentity &
  Readonly<{ match: Readonly<{ timeControl: TimeControl }> }>

export type HomeState = Readonly<{
  playerData: MapachessPlayerData | null
  disabled: boolean
  settingsDisabled: boolean
  settingsOpen: boolean
  resumeMatch: Readonly<{ timeControl: TimeControl; disabled: boolean }> | null
}>

export type HomeCommands = Readonly<{
  selectMode: (selection: MatchModeSelection) => void
  resume: () => void
  customize: () => void
  share: () => void
  settings: () => void
}>

export function profileAllowsMatchOpening(
  snapshot: ProfileMachineSnapshot,
): boolean {
  const current = selectCurrentPlayerData(snapshot)
  const pending = selectPendingPlayerData(snapshot)
  return (
    (snapshot.matches("ready") || selectCanChangeAutoHintMode(snapshot)) &&
    current !== null &&
    (pending === null ||
      samePlayerAppearance(current.appearance, pending.appearance))
  )
}

export function selectHome<Session extends HomeSession>(
  profile: ProfileMachineSnapshot,
  session: MatchSessionMachineSnapshot<Session>,
  settingsOpen = false,
): HomeState {
  const accepted = selectCurrentPlayerData(profile)
  const resumable =
    session.context.session?.match ??
    (session.context.activeMatchExists ? (accepted?.activeMatch ?? null) : null)
  const choosingMode = session.matches({ menu: "choosingMode" })
  const blocked = settingsOpen || session.context.overlays.length > 0
  return {
    playerData: selectPendingPlayerData(profile) ?? accepted,
    disabled: !profileAllowsMatchOpening(profile) || !choosingMode || blocked,
    settingsDisabled: !choosingMode,
    settingsOpen: settingsOpen || session.context.overlays.includes("settings"),
    resumeMatch:
      resumable === null
        ? null
        : {
            timeControl: resumable.timeControl,
            disabled:
              !choosingMode || blocked || !selectCanNavigateProfile(profile),
          },
  }
}

export default function createHomeCommands<Session extends HomeSession>({
  profileActor,
  sessionActor,
  navigation,
  generateChess960Position,
  settingsOpen = () => false,
  openSettings = () => navigation.open("settings"),
}: Readonly<{
  profileActor: ProfileActor
  sessionActor: MatchSessionActor<Session>
  navigation: MatchNavigationCommands
  generateChess960Position: () => Chess960PositionId
  settingsOpen?: () => boolean
  openSettings?: () => void
}>): HomeCommands {
  const current = (): HomeState =>
    selectHome(
      profileActor.getSnapshot(),
      sessionActor.getSnapshot(),
      settingsOpen(),
    )
  return {
    selectMode: (selection) => {
      const home = current()
      if (home.disabled || home.playerData === null) return
      const data = home.playerData
      const setup = createMatchSetupForMode(
        selection,
        data.settings.challengeSetup,
        selectDefaultStoryOpponent(data.storyProgress, selection.variant),
      )
      sessionActor.send({
        type: "MATCH_SESSION.SETUP_REQUESTED",
        setup:
          setup.mode === "challenge" &&
          setup.challengeSetup.variant === "chess960"
            ? {
                ...setup,
                displayedChess960PositionId:
                  setup.challengeSetup.chess960PositionId ??
                  generateChess960Position(),
              }
            : setup,
      })
    },
    resume: () => {
      const resume = current().resumeMatch
      if (resume !== null && !resume.disabled)
        sessionActor.send({ type: "MATCH_SESSION.RESUME_REQUESTED" })
    },
    customize: () => {
      if (!current().disabled) navigation.open("dressing-room")
    },
    share: () => {
      if (!current().disabled) navigation.open("profile-card")
    },
    settings: () => {
      if (!current().settingsDisabled) openSettings()
    },
  }
}

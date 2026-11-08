import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, BackHandler, View } from "react-native"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import type { MatchSessionController } from "@mapachess/gameplay/session-controller"
import { selectHintStage } from "@mapachess/match/match-machine"
import type { MatchNavigationCommands } from "@mapachess/match/match-navigation"
import {
  selectCanHandleMatchSessionBack,
  selectMatchNavigationDestination,
} from "@mapachess/match/match-session-machine"
import createMatchSetupForMode, {
  type MatchSetup,
} from "@mapachess/match/match-setup"
import type { PlayerInputAction } from "@mapachess/match/player-input"
import {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import { selectDefaultStoryOpponent } from "@mapachess/profile/story-progress"
import type { NativeApplicationRuntime } from "@/lib/gameplay/openNativeApplicationRuntime"
import type { NativeMatchRuntime } from "@/lib/gameplay/openNativeMatchRuntime"
import type useNativeFileActions from "@/lib/profile/useNativeFileActions"
import useActorSnapshot from "@/lib/useActorSnapshot"
import { NativeInputSurface } from "../input/NativeInputProvider"
import NativeButton from "../presentation/NativeButton"
import NativeText from "../presentation/NativeText"
import NativeCardJourney from "../profile/NativeCardJourney"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeSettings from "../profile/NativeSettings"
import NativeHome from "./NativeHome"
import NativeMatch from "./NativeMatch"
import NativeMatchSetup from "./NativeMatchSetup"

function ReadyNativeGame({
  runtime,
  controller,
  files,
}: Readonly<{
  runtime: NativeApplicationRuntime
  controller: MatchSessionController<NativeMatchRuntime>
  files: ReturnType<typeof useNativeFileActions>
}>) {
  const actor = controller.actor
  const snapshot = useActorSnapshot(actor)
  const profile = useActorSnapshot(runtime.profile.actor)
  const { copy } = useNativeLocale()
  const data = selectCurrentPlayerData(profile)
  const displayed = selectPendingPlayerData(profile) ?? data
  const destination = selectMatchNavigationDestination(snapshot)
  const navigation = useMemo<MatchNavigationCommands>(
    () => ({
      back: () => actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" }),
      open: (overlay) =>
        actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay }),
      close: (overlay) =>
        actor.send({ type: "MATCH_SESSION.OVERLAY_CLOSED", overlay }),
    }),
    [actor],
  )
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!selectCanHandleMatchSessionBack(actor.getSnapshot())) return false
        navigation.back()
        return true
      },
    )
    return () => subscription.remove()
  }, [actor, navigation])
  if (data === null || displayed === null) return null
  const disabled = !profile.matches("ready")
  const overlays = snapshot.context.overlays
  const session = snapshot.context.session
  const setup = snapshot.context.requestedSetup
  const setupVariant =
    setup.mode === "story" ? setup.variant : setup.challengeSetup.variant
  const requestSetup = (setup: MatchSetup): void =>
    actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup })
  const pending = destination === null && !snapshot.matches("failed")
  const handleAction = (action: PlayerInputAction): boolean => {
    if (action === "cancel") {
      navigation.back()
      return true
    }
    if (action === "menu") {
      navigation.open(
        destination?.screen === "match" ? "match-menu" : "settings",
      )
      return true
    }
    if (action === "controls") {
      navigation.open("settings")
      navigation.open("settings-controls")
      return true
    }
    if (session === null || destination?.screen !== "match") return false
    if (action === "undo" || action === "redo") {
      session.actor.send({
        type:
          action === "undo" ? "MATCH.UNDO_REQUESTED" : "MATCH.REDO_REQUESTED",
      })
      return true
    }
    if (action === "hints") {
      session.actor.send({
        type:
          selectHintStage(session.actor.getSnapshot()) === "piece-hints"
            ? "MATCH.MOVE_HINTS_REQUESTED"
            : "MATCH.PIECE_HINTS_REQUESTED",
      })
      return true
    }
    return false
  }
  return (
    <NativeInputSurface onAction={handleAction}>
      {destination?.screen === "menu" ? (
        <NativeHome
          data={displayed}
          disabled={disabled}
          onSelect={({ mode, variant }) =>
            requestSetup(
              createMatchSetupForMode(
                { mode, variant },
                displayed.settings.challengeSetup,
                selectDefaultStoryOpponent(displayed.storyProgress, variant),
              ),
            )
          }
          onResume={() =>
            actor.send({ type: "MATCH_SESSION.RESUME_REQUESTED" })
          }
          onSettings={() => navigation.open("settings")}
          onCustomize={() => navigation.open("dressing-room")}
          onShare={() => navigation.open("profile-card")}
        />
      ) : null}
      {destination?.screen === "setup" ? (
        <NativeMatchSetup
          key={`${setup.mode}:${setupVariant}:${setup.mode === "story" ? (setup.opponentId ?? "default") : setup.challengeSetup.opponentId}`}
          initial={setup}
          data={displayed}
          profileActor={runtime.profile.actor}
          disabled={disabled}
          navigation={navigation}
          overlay={overlays.at(-1)}
          onStart={(selection) =>
            actor.send({
              type: "MATCH_SESSION.MATCH_REQUESTED",
              setup: selection,
            })
          }
        />
      ) : null}
      {session === null ? null : (
        <View
          accessibilityElementsHidden={destination?.screen !== "match"}
          importantForAccessibility={
            destination?.screen === "match" ? "auto" : "no-hide-descendants"
          }
          pointerEvents={destination?.screen === "match" ? "auto" : "none"}
          className={
            destination?.screen === "match" ? "min-h-0 flex-1" : "hidden"
          }
        >
          <NativeMatch
            key={session.match.matchId}
            session={session}
            appActor={actor}
            data={data}
            navigation={navigation}
            overlays={overlays}
            visible={destination?.screen === "match"}
            initiallyConcluded={
              session.match.conclusion !== null &&
              !snapshot.context.resultReopened
            }
            celebrationDismissed={
              snapshot.context.dismissedRewardMatchId === session.match.matchId
            }
            replaySequence={snapshot.context.rewardsReplaySequence}
            onAction={handleAction}
            onSetup={requestSetup}
            onReplay={() =>
              actor.send({ type: "MATCH_SESSION.RESTART_REQUESTED" })
            }
          />
        </View>
      )}
      {overlays.includes("settings") ? (
        <NativeSettings
          actor={runtime.profile.actor}
          data={displayed}
          disabled={disabled}
          navigation={navigation}
          overlay={overlays.at(-1)}
          files={files}
          onAutoHintModeChanged={(autoHintMode) => {
            if (session === null)
              runtime.profile.actor.send({
                type: "PROFILE.AUTO_HINT_MODE_CHANGED",
                autoHintMode,
              })
            else
              session.actor.send({
                type: "MATCH.AUTO_HINT_MODE_CHANGED",
                autoHintMode,
              })
          }}
        />
      ) : null}
      {overlays.includes("dressing-room") ||
      overlays.includes("profile-card") ? (
        <NativeCardJourney
          actor={runtime.profile.actor}
          data={data}
          overlays={overlays}
          navigation={navigation}
        />
      ) : null}
      {snapshot.matches("failed") ? (
        <View className="flex-1 justify-center gap-4 p-4">
          <NativeText
            accessibilityRole="alert"
            className="font-native text-2xl"
          >
            {snapshot.context.failure?.operation === "open-current-match"
              ? copy.presentation.sessionFailure["open-current-match"]
              : copy.presentation.sessionFailure.start}
          </NativeText>
          <NativeText>
            {
              copy.interface.webGame
                .yourLastVerifiedLocalProfileRemainsAvailable
            }
          </NativeText>
          <NativeButton
            onPress={() =>
              actor.send({ type: "MATCH_SESSION.RETRY_REQUESTED" })
            }
          >
            {copy.interface.webGame.retry}
          </NativeButton>
          <NativeButton
            variant="secondary"
            onPress={() => {
              void files.exportData()
            }}
          >
            {copy.interface.profileSettingsPanel.exportPlayerData}
          </NativeButton>
          {session === null ? (
            <NativeButton variant="secondary" onPress={navigation.back}>
              {copy.interface.profileCardJourney.back}
            </NativeButton>
          ) : null}
        </View>
      ) : null}
      {pending ? (
        <View
          accessibilityLabel={copy.setup.openingMatch}
          className="bg-mapachito-charcoal absolute inset-0 items-center justify-center gap-3"
        >
          <ActivityIndicator size="large" />
          <NativeText>{copy.setup.openingMatch}</NativeText>
        </View>
      ) : null}
    </NativeInputSurface>
  )
}

export default function NativeGame({
  runtime,
  files,
}: Readonly<{
  runtime: NativeApplicationRuntime
  files: ReturnType<typeof useNativeFileActions>
}>) {
  const [controller, setController] =
    useState<MatchSessionController<NativeMatchRuntime> | null>(null)
  const [failure, setFailure] = useState<ErrorDiagnostic | null>(null)
  const { copy } = useNativeLocale()
  const open = (): void => {
    try {
      setController(runtime.game())
      setFailure(null)
    } catch (error: unknown) {
      setFailure(captureError(error))
    }
  }
  useEffect(open, [runtime])
  return controller === null ? (
    <View className="flex-1 items-center justify-center gap-4 p-4">
      <NativeText>
        {failure !== null
          ? copy.presentation.sessionFailure.start
          : copy.setup.openingMatch}
      </NativeText>
      {failure !== null ? (
        <NativeButton onPress={open}>
          {copy.interface.webGame.retry}
        </NativeButton>
      ) : (
        <ActivityIndicator size="large" />
      )}
    </View>
  ) : (
    <ReadyNativeGame runtime={runtime} controller={controller} files={files} />
  )
}

"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useState, type ReactNode, type Ref } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import {
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectPersistenceFailure,
} from "@mapachess/match/match-machine"
import createMatchSetupForMode, {
  MATCH_SETUP_COPY,
} from "@mapachess/match/match-setup"
import profileMachine, {
  selectCanChangeAutoHintMode,
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import { selectDefaultStoryOpponent } from "@mapachess/profile/story-progress"
import {
  openCurrentWebMatchSession,
  openFreshWebMatchSession,
  returnWebMatchSessionToMenu,
} from "../../lib/gameplay/webMatchSession"
import webMatchSessionMachine, {
  selectWebMatchSession,
  selectWebMatchSessionFailure,
  type WebMatchSession,
  type WebMatchSessionFailureOperation,
} from "../../lib/gameplay/webMatchSessionMachine"
import { generateWebChess960Position } from "../../lib/gameplay/webOpponent"
import MapachessButton from "../presentation/MapachessButton"
import MapachessLoadingSurface from "../presentation/MapachessLoadingSurface"
import MapachessShell from "../presentation/MapachessShell"
import MapachessWordmark from "../presentation/MapachessWordmark"
import MatchModeMenu from "./MatchModeMenu"
import StoryMatchResult from "./StoryMatchResult"
import WebMatch from "./WebMatch"
import WebMatchSetup from "./WebMatchSetup"

type WebMatchSessionActor = ActorRefFrom<typeof webMatchSessionMachine>

export type WebGameProps = Readonly<{
  onActiveMatchActorChanged: (actor: WebMatchSession["actor"] | null) => void
  onSettingsRequested: () => void
  profileActor: ActorRefFrom<typeof profileMachine>
  settingsButtonRef: Ref<HTMLButtonElement>
  settingsOpen: boolean
}>

type GameFrameProps = Omit<
  WebGameProps,
  "onActiveMatchActorChanged" | "profileActor"
> &
  Readonly<{
    children: ReactNode
    activityMessage?: string | null
    matchSessionActive: boolean
  }>

function GameFrame({
  children,
  activityMessage = null,
  matchSessionActive,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
}: GameFrameProps) {
  const settingsButton = (
    <MapachessButton
      variant="secondary"
      aria-controls="profile-settings-panel"
      aria-expanded={settingsOpen}
      onClick={onSettingsRequested}
      ref={settingsButtonRef}
      type="button"
    >
      Settings
    </MapachessButton>
  )
  return (
    <MapachessShell spacing={matchSessionActive ? "match" : "page"}>
      {matchSessionActive ? null : (
        <header
          inert={activityMessage !== null}
          className={`mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between ${matchSessionActive ? "mb-2 gap-2 px-3 xl:px-0" : "mb-4 gap-3"}`}
        >
          <MapachessWordmark />
          {settingsButton}
        </header>
      )}

      <p className="sr-only" role="status">
        {activityMessage}
      </p>
      <div
        aria-busy={activityMessage !== null}
        inert={activityMessage !== null}
        className="mx-auto w-full max-w-[96rem]"
      >
        {children}
      </div>
    </MapachessShell>
  )
}

const openingTitle = (actor: WebMatchSessionActor): string | null => {
  const snapshot = actor.getSnapshot()
  if (snapshot.matches("openingCurrentMatch")) return "Resuming saved match…"
  if (snapshot.matches("restartingMatch"))
    return MATCH_SETUP_COPY.restartingMatch
  if (snapshot.matches("returningToMenu"))
    return MATCH_SETUP_COPY.returningToMenu
  if (snapshot.matches("openingFreshMatch"))
    return MATCH_SETUP_COPY.openingMatch
  return null
}

const failureTitle = (operation: WebMatchSessionFailureOperation): string => {
  if (operation === "open-current-match") {
    return "Your saved match could not open."
  }
  if (operation === "restart-match") return "Your match could not restart."
  if (operation === "return-to-menu") {
    return "Mapachess could not return to the menu."
  }
  return "Your match could not start."
}

function MatchSessionExperience({
  actor,
  onActiveMatchActorChanged,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
  profileActor,
}: WebGameProps & Readonly<{ actor: WebMatchSessionActor }>) {
  const snapshot = useSelector(actor, (current) => current)
  const profileSnapshot = useSelector(profileActor, (current) => current)
  const savedPlayerData = selectCurrentPlayerData(profileSnapshot)
  const savedMatch = savedPlayerData?.activeMatch ?? null
  const playerData =
    selectPendingPlayerData(profileSnapshot) ??
    selectCurrentPlayerData(profileSnapshot)
  if (playerData === null)
    throw new Error("Match setup requires a valid player profile.")
  const profileReady =
    selectCanChangeAutoHintMode(profileSnapshot) && !settingsOpen
  const requestedSetup = snapshot.context.requestedSetup
  const variant =
    requestedSetup.mode === "story"
      ? requestedSetup.variant
      : requestedSetup.challengeSetup.variant
  const initialSetup =
    requestedSetup.mode === "challenge" ||
    requestedSetup.opponentId !== undefined
      ? requestedSetup
      : createMatchSetupForMode(
          { mode: requestedSetup.mode, variant },
          playerData.settings.challengeSetup,
          selectDefaultStoryOpponent(playerData.storyProgress, variant),
        )
  const session = selectWebMatchSession(snapshot)
  const failure = selectWebMatchSessionFailure(snapshot)
  const activeMatchActor = snapshot.matches("active") ? session?.actor : null

  useEffect(() => {
    onActiveMatchActorChanged(activeMatchActor ?? null)
    return () => onActiveMatchActorChanged(null)
  }, [activeMatchActor, onActiveMatchActorChanged])

  if (snapshot.matches("active") && session === null) {
    throw new Error("Active web match state has no owned session.")
  }

  if (snapshot.matches("openingCurrentMatch")) {
    return <MapachessLoadingSurface />
  }

  const openingFreshMatch = snapshot.matches("openingFreshMatch")
  const retainingMatch =
    snapshot.matches("active") ||
    snapshot.matches("restartingMatch") ||
    snapshot.matches("returningToMenu")

  return (
    <GameFrame
      activityMessage={openingTitle(actor)}
      matchSessionActive={retainingMatch}
      onSettingsRequested={onSettingsRequested}
      settingsButtonRef={settingsButtonRef}
      settingsOpen={settingsOpen}
    >
      {snapshot.matches({ menu: "choosingMode" }) ? (
        <MatchModeMenu
          disabled={!profileReady}
          onModeSelected={(selection) => {
            if (
              !selectCanChangeAutoHintMode(profileActor.getSnapshot()) ||
              settingsOpen
            )
              return
            const setup = createMatchSetupForMode(
              selection,
              playerData.settings.challengeSetup,
              selectDefaultStoryOpponent(
                playerData.storyProgress,
                selection.variant,
              ),
            )
            actor.send({
              type: "WEB_MATCH_SESSION.SETUP_REQUESTED",
              setup:
                setup.mode === "challenge" &&
                setup.challengeSetup.variant === "chess960"
                  ? {
                      ...setup,
                      displayedChess960PositionId:
                        setup.challengeSetup.chess960PositionId ??
                        generateWebChess960Position(globalThis.crypto),
                    }
                  : setup,
            })
          }}
        />
      ) : snapshot.matches({ menu: "setup" }) || openingFreshMatch ? (
        <WebMatchSetup
          opening={openingFreshMatch}
          challengeHistory={playerData.challengeHistory}
          autoHintMode={playerData.settings.autoHintMode}
          disabled={!profileReady && !openingFreshMatch}
          key={`${requestedSetup.mode}:${variant}`}
          onAutoHintModeChanged={(autoHintMode) =>
            profileActor.send({
              type: "PROFILE.AUTO_HINT_MODE_CHANGED",
              autoHintMode,
            })
          }
          onBack={() =>
            actor.send({ type: "WEB_MATCH_SESSION.MAIN_MENU_REQUESTED" })
          }
          onStart={(setup) => {
            if (
              !selectCanChangeAutoHintMode(profileActor.getSnapshot()) ||
              settingsOpen
            )
              return
            actor.send({ type: "WEB_MATCH_SESSION.MATCH_REQUESTED", setup })
          }}
          setup={initialSetup}
          storyProgress={playerData.storyProgress}
        />
      ) : retainingMatch && session !== null ? (
        <WebMatch
          menuActions={
            <>
              <MapachessButton
                aria-busy={snapshot.matches("restartingMatch")}
                busyLabel={MATCH_SETUP_COPY.restartingMatch}
                variant="secondary"
                onClick={() =>
                  actor.send({ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" })
                }
              >
                Restart Match
              </MapachessButton>
              <MapachessButton
                aria-busy={snapshot.matches("returningToMenu")}
                busyLabel={MATCH_SETUP_COPY.returningToMenu}
                variant="secondary"
                onClick={() =>
                  actor.send({
                    type: "WEB_MATCH_SESSION.RETURN_TO_MENU_REQUESTED",
                  })
                }
              >
                Return to Menu
              </MapachessButton>
              <MapachessButton
                variant="secondary"
                aria-controls="profile-settings-panel"
                aria-expanded={settingsOpen}
                onClick={onSettingsRequested}
                ref={settingsButtonRef}
              >
                Settings
              </MapachessButton>
            </>
          }
          actor={session.actor}
          evaluationActor={session.evaluationActor}
          moveFeedback={
            savedMatch?.matchId === session.match.matchId
              ? (savedMatch.moveFeedback ?? [])
              : []
          }
          reactionsPaused={settingsOpen}
          key={session.match.matchId}
          mode={session.match.mode}
          playerEloAtStart={session.match.playerEloAtStart}
          runtime={session.runtime}
          result={(matchBusy) =>
            savedPlayerData !== null &&
            savedMatch !== null &&
            savedMatch.matchId === session.match.matchId ? (
              <StoryMatchResult
                match={savedMatch}
                progress={savedPlayerData.storyProgress}
                disabled={
                  matchBusy || !profileSnapshot.matches("ready") || settingsOpen
                }
                opening={snapshot.matches("returningToMenu")}
                onSetupRequested={(setup) => {
                  const matchSnapshot = session.actor.getSnapshot()
                  if (
                    !profileActor.getSnapshot().matches("ready") ||
                    selectIsPersistingMutation(matchSnapshot) ||
                    selectPersistenceFailure(matchSnapshot) !== null ||
                    selectMatchConclusion(matchSnapshot) === null ||
                    settingsOpen
                  )
                    return
                  actor.send({
                    type: "WEB_MATCH_SESSION.SETUP_REQUESTED",
                    setup,
                  })
                }}
              />
            ) : null
          }
        />
      ) : snapshot.matches("failed") && failure !== null ? (
        <section
          aria-live="assertive"
          className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal grid min-h-[min(74dvh,50rem)] place-items-center rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-8 text-center shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
        >
          <div role="alert">
            <h1 className="font-display text-mapachito-charcoal text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase">
              {failureTitle(failure.operation)}
            </h1>
            <p className="text-mapachito-charcoal mt-4 max-w-lg leading-[1.55] font-semibold opacity-76">
              Your last verified local profile remains available. Retry the
              interrupted session operation.
            </p>
            <MapachessButton
              className="mt-6"
              onClick={() =>
                actor.send({ type: "WEB_MATCH_SESSION.RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry
            </MapachessButton>
          </div>
        </section>
      ) : null}
    </GameFrame>
  )
}

export default function WebGame({
  onActiveMatchActorChanged,
  profileActor,
  ...frameProps
}: WebGameProps) {
  const [sessionActor, setSessionActor] = useState<WebMatchSessionActor | null>(
    null,
  )

  useEffect(() => {
    const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
    if (playerData === null) {
      throw new Error("A valid player profile is required to enter play.")
    }

    let disposed = false
    let latestSession: WebMatchSession | null = null
    const captureSession = async (
      sessionPromise: Promise<WebMatchSession>,
    ): Promise<WebMatchSession> => {
      const session = await sessionPromise
      latestSession = session
      if (disposed) {
        await session.close()
        throw new DOMException("Web match view was closed.", "AbortError")
      }
      return session
    }

    const actor = createActor(webMatchSessionMachine, {
      input: {
        activeMatchExists: playerData.activeMatch !== null,
        operations: {
          openCurrentMatch: (signal) =>
            captureSession(
              openCurrentWebMatchSession({
                profileActor,
                signal,
              }),
            ),
          openFreshMatch: (previousSession, setup, signal) =>
            captureSession(
              openFreshWebMatchSession({
                previousSession,
                ...setup,
                profileActor,
                signal,
              }),
            ),
          returnToMenu: async (session, signal) => {
            await returnWebMatchSessionToMenu({
              profileActor,
              session,
              signal,
            })
            if (latestSession === session) latestSession = null
          },
        },
      },
    }).start()
    setSessionActor(actor)

    return () => {
      disposed = true
      actor.stop()
      if (latestSession !== null) {
        void latestSession.close().catch(() => undefined)
      }
    }
  }, [profileActor])

  if (sessionActor !== null) {
    return (
      <MatchSessionExperience
        actor={sessionActor}
        profileActor={profileActor}
        onActiveMatchActorChanged={onActiveMatchActorChanged}
        {...frameProps}
      />
    )
  }

  return <MapachessLoadingSurface />
}

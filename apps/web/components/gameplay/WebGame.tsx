"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useState, type ReactNode, type Ref } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import createMatchSetupForMode, {
  MATCH_SETUP_COPY,
} from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import profileMachine, {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
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
import MapachessButton from "../presentation/MapachessButton"
import MapachessShell from "../presentation/MapachessShell"
import MapachessWordmark from "../presentation/MapachessWordmark"
import MatchModeMenu from "./MatchModeMenu"
import WebMatchSetup from "./WebMatchSetup"
import WebStoryMatch from "./WebStoryMatch"

const FIRST_STORY_OPPONENT = stockfishOpponent("chicken-stockfish")

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
    matchSessionActive: boolean
    onRestartRequested?: () => void
    onReturnToMenuRequested?: () => void
  }>

function GameFrame({
  children,
  matchSessionActive,
  onRestartRequested,
  onReturnToMenuRequested,
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
}: GameFrameProps) {
  return (
    <MapachessShell>
      <header className="mx-auto mb-[clamp(1.5rem,3vw,2.5rem)] flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-5">
        <MapachessWordmark />
        <div className="flex flex-wrap items-center gap-3">
          {matchSessionActive ? (
            <>
              <MapachessButton
                variant="secondary"
                onClick={onRestartRequested}
                type="button"
              >
                Restart Match
              </MapachessButton>
              <MapachessButton
                variant="secondary"
                onClick={onReturnToMenuRequested}
                type="button"
              >
                Return to Menu
              </MapachessButton>
            </>
          ) : null}
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
        </div>
      </header>

      <div className="mx-auto w-full max-w-[96rem]">{children}</div>
    </MapachessShell>
  )
}

const openingTitle = (actor: WebMatchSessionActor): string => {
  const snapshot = actor.getSnapshot()
  if (snapshot.matches("openingCurrentMatch")) return "Resuming saved match…"
  if (snapshot.matches("restartingMatch")) return "Restarting match…"
  if (snapshot.matches("returningToMenu")) return "Returning to menu…"
  return "Opening match…"
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
  const playerData =
    selectPendingPlayerData(profileSnapshot) ??
    selectCurrentPlayerData(profileSnapshot)
  if (playerData === null)
    throw new Error("Match setup requires a valid player profile.")
  const profileReady = profileSnapshot.matches("ready") && !settingsOpen
  const requestedSetup = snapshot.context.requestedSetup
  const variant =
    requestedSetup.mode === "story"
      ? requestedSetup.variant
      : requestedSetup.challengeSetup.variant
  const initialSetup = createMatchSetupForMode(
    { mode: requestedSetup.mode, variant },
    playerData.settings.challengeSetup,
  )
  const setupActivity =
    profileSnapshot.matches("persisting") ||
    profileSnapshot.matches("retryingPersistence")
      ? MATCH_SETUP_COPY.savingHints
      : profileReady
        ? null
        : MATCH_SETUP_COPY.profileUnavailable
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

  return (
    <GameFrame
      matchSessionActive={snapshot.matches("active")}
      onRestartRequested={() =>
        actor.send({ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" })
      }
      onReturnToMenuRequested={() =>
        actor.send({ type: "WEB_MATCH_SESSION.RETURN_TO_MENU_REQUESTED" })
      }
      onSettingsRequested={onSettingsRequested}
      settingsButtonRef={settingsButtonRef}
      settingsOpen={settingsOpen}
    >
      {snapshot.matches({ menu: "choosingMode" }) ? (
        <MatchModeMenu
          disabled={!profileReady}
          onModeSelected={(selection) => {
            if (!profileActor.getSnapshot().matches("ready") || settingsOpen)
              return
            actor.send({
              type: "WEB_MATCH_SESSION.SETUP_REQUESTED",
              setup: createMatchSetupForMode(
                selection,
                playerData.settings.challengeSetup,
              ),
            })
          }}
        />
      ) : snapshot.matches({ menu: "setup" }) ? (
        <WebMatchSetup
          activityMessage={setupActivity}
          autoHintMode={playerData.settings.autoHintMode}
          disabled={!profileReady}
          key={JSON.stringify(initialSetup)}
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
            if (!profileActor.getSnapshot().matches("ready") || settingsOpen)
              return
            actor.send({ type: "WEB_MATCH_SESSION.MATCH_REQUESTED", setup })
          }}
          opponent={FIRST_STORY_OPPONENT}
          setup={initialSetup}
        />
      ) : snapshot.matches("active") && session !== null ? (
        <WebStoryMatch
          actor={session.actor}
          evaluationActor={session.evaluationActor}
          key={session.match.matchId}
          playerEloAtStart={session.match.playerEloAtStart}
          runtime={session.runtime}
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
      ) : (
        <section
          aria-live="polite"
          className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal grid min-h-[min(74dvh,50rem)] place-items-center rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-8 text-center shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
        >
          <div role="status">
            <div
              aria-hidden="true"
              className="border-mapachito-raspberry border-t-mapachito-orange border-r-mapachito-green bg-mapachito-violet mx-auto size-14 rotate-8 animate-[mapachess-loading-turn_900ms_steps(8,end)_infinite] border-[0.625rem] motion-reduce:animate-none"
            />
            <h1 className="font-display text-mapachito-charcoal mt-6 text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase">
              {openingTitle(actor)}
            </h1>
            <p className="text-mapachito-charcoal mt-4 leading-[1.55] font-semibold opacity-76">
              Loading the pinned local engine and validating its identity.
            </p>
          </div>
        </section>
      )}
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

  return (
    <GameFrame matchSessionActive={false} {...frameProps}>
      <section
        aria-live="polite"
        className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal grid min-h-[min(74dvh,50rem)] place-items-center rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-8 text-center shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
      >
        <h1 className="font-display text-mapachito-charcoal text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase">
          Opening Mapachess…
        </h1>
      </section>
    </GameFrame>
  )
}

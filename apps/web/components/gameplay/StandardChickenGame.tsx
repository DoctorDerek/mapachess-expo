"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useState, type ReactNode, type Ref } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import {
  openCurrentStandardChickenMatchSession,
  openFreshStandardChickenMatchSession,
  returnStandardChickenMatchSessionToMenu,
} from "../../lib/chicken/standardChickenWebMatchSession"
import webMatchSessionMachine, {
  selectWebMatchSession,
  selectWebMatchSessionFailure,
  type WebMatchSession,
  type WebMatchSessionFailureOperation,
} from "../../lib/gameplay/webMatchSessionMachine"
import MapachessWordmark from "../presentation/MapachessWordmark"
import StandardChickenMatch from "./StandardChickenMatch"

type WebMatchSessionActor = ActorRefFrom<typeof webMatchSessionMachine>

const secondaryControlClasses =
  "mapachess-button mapachess-button--secondary min-h-11 px-4 py-2"

const primaryControlClasses =
  "mapachess-button mapachess-button--primary min-h-12 px-5 py-3"

const retryControlClasses =
  "mapachess-button mapachess-button--primary min-h-12 px-5 py-3"

export type StandardChickenGameProps = Readonly<{
  onActiveMatchActorChanged: (actor: WebMatchSession["actor"] | null) => void
  onSettingsRequested: () => void
  profileActor: ActorRefFrom<typeof profileMachine>
  settingsButtonRef: Ref<HTMLButtonElement>
  settingsOpen: boolean
}>

type GameFrameProps = Omit<
  StandardChickenGameProps,
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
    <div className="mapachess-shell px-[clamp(1rem,3vw,3rem)] py-[clamp(1.5rem,4vw,3rem)]">
      <header className="mx-auto mb-[clamp(1.5rem,3vw,2.5rem)] flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-5">
        <MapachessWordmark />
        <div className="flex flex-wrap items-center gap-3">
          {matchSessionActive ? (
            <>
              <button
                className={secondaryControlClasses}
                onClick={onRestartRequested}
                type="button"
              >
                Restart Match
              </button>
              <button
                className={secondaryControlClasses}
                onClick={onReturnToMenuRequested}
                type="button"
              >
                Return to Menu
              </button>
            </>
          ) : null}
          <button
            aria-controls="profile-settings-panel"
            aria-expanded={settingsOpen}
            className={secondaryControlClasses}
            onClick={onSettingsRequested}
            ref={settingsButtonRef}
            type="button"
          >
            Settings
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[96rem]">{children}</div>
    </div>
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
}: Omit<StandardChickenGameProps, "profileActor"> &
  Readonly<{ actor: WebMatchSessionActor }>) {
  const snapshot = useSelector(actor, (current) => current)
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
      {snapshot.matches("menu") ? (
        <section
          aria-labelledby="standard-story-title"
          className="mapachess-story-board mapachess-surface mx-auto max-w-5xl p-[clamp(1.5rem,5vw,3.5rem)]"
        >
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-center">
            <div>
              <p className="mapachess-eyebrow">Story opponent 1 of 23</p>
              <h1 className="mapachess-display mt-4" id="standard-story-title">
                Standard Story
              </h1>
              <p className="mapachess-copy mt-6 max-w-2xl">
                Your first animal challenge is a complete local game of Standard
                chess. The 100-Elo target stays explicitly provisional while
                calibration and human playtesting continue.
              </p>
            </div>
            <div aria-hidden="true" className="mapachess-opponent-poster">
              <span className="mapachess-opponent-poster__number">01</span>
              <span className="mapachess-opponent-poster__label">
                First opponent
              </span>
            </div>
          </div>

          <article className="mt-9 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <h2 className="mapachess-section-title">Chicken Stockfish</h2>
              <dl className="mapachess-story-facts mt-4 overflow-hidden">
                <div className="flex items-baseline justify-between gap-5 px-5 py-3">
                  <dt>Variant</dt>
                  <dd>Standard</dd>
                </div>
                <div className="flex items-baseline justify-between gap-5 px-5 py-3">
                  <dt>Clock</dt>
                  <dd>Untimed</dd>
                </div>
                <div className="flex items-baseline justify-between gap-5 px-5 py-3">
                  <dt>Strength</dt>
                  <dd>Provisional 100-Elo target</dd>
                </div>
              </dl>
            </div>
            <button
              className={primaryControlClasses}
              onClick={() =>
                actor.send({ type: "WEB_MATCH_SESSION.MATCH_REQUESTED" })
              }
              type="button"
            >
              Play Chicken Stockfish
            </button>
          </article>
        </section>
      ) : snapshot.matches("active") && session !== null ? (
        <StandardChickenMatch
          actor={session.actor}
          evaluationActor={session.evaluationActor}
          key={session.match.matchId}
          runtime={session.runtime}
        />
      ) : snapshot.matches("failed") && failure !== null ? (
        <section
          aria-live="assertive"
          className="mapachess-surface grid min-h-[min(74dvh,50rem)] place-items-center p-8 text-center"
        >
          <div role="alert">
            <h1 className="mapachess-section-title">
              {failureTitle(failure.operation)}
            </h1>
            <p className="mapachess-muted mt-4 max-w-lg">
              Your last verified local profile remains available. Retry the
              interrupted session operation.
            </p>
            <button
              className={`${retryControlClasses} mt-6`}
              onClick={() =>
                actor.send({ type: "WEB_MATCH_SESSION.RETRY_REQUESTED" })
              }
              type="button"
            >
              Retry
            </button>
          </div>
        </section>
      ) : (
        <section
          aria-live="polite"
          className="mapachess-surface grid min-h-[min(74dvh,50rem)] place-items-center p-8 text-center"
        >
          <div role="status">
            <div
              aria-hidden="true"
              className="mapachess-loading-mark mx-auto motion-reduce:animate-none"
            />
            <h1 className="mapachess-section-title mt-6">
              {openingTitle(actor)}
            </h1>
            <p className="mapachess-muted mt-4">
              Loading the pinned local engine and validating its identity.
            </p>
          </div>
        </section>
      )}
    </GameFrame>
  )
}

export default function StandardChickenGame({
  onActiveMatchActorChanged,
  profileActor,
  ...frameProps
}: StandardChickenGameProps) {
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
              openCurrentStandardChickenMatchSession({
                profileActor,
                signal,
              }),
            ),
          openFreshMatch: (previousSession, signal) =>
            captureSession(
              openFreshStandardChickenMatchSession({
                previousSession,
                profileActor,
                signal,
              }),
            ),
          returnToMenu: async (session, signal) => {
            await returnStandardChickenMatchSessionToMenu({
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
        onActiveMatchActorChanged={onActiveMatchActorChanged}
        {...frameProps}
      />
    )
  }

  return (
    <GameFrame matchSessionActive={false} {...frameProps}>
      <section
        aria-live="polite"
        className="mapachess-surface grid min-h-[min(74dvh,50rem)] place-items-center p-8 text-center"
      >
        <h1 className="mapachess-section-title">Opening Mapachess…</h1>
      </section>
    </GameFrame>
  )
}

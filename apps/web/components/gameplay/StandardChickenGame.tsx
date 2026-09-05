"use client"

import { useSelector } from "@xstate/react"
import { useEffect, useState, type ReactNode, type Ref } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import { STANDARD_CHICKEN_PROVISIONAL_TARGET_ELO } from "../../lib/chicken/standardChickenOpponent"
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
import MapachessButton from "../presentation/MapachessButton"
import MapachessShell from "../presentation/MapachessShell"
import MapachessWordmark from "../presentation/MapachessWordmark"
import StandardChickenMatch from "./StandardChickenMatch"

type WebMatchSessionActor = ActorRefFrom<typeof webMatchSessionMachine>

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
          className="before:border-mapachito-violet/20 border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal relative mx-auto max-w-5xl overflow-hidden rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-[clamp(1.5rem,5vw,3.5rem)] shadow-[0.625rem_0.625rem_0] before:absolute before:top-0 before:right-0 before:size-[clamp(4.5rem,18vw,10rem)] before:translate-x-[30%] before:-translate-y-[35%] before:rotate-18 before:border-[1.5rem] forced-colors:border-[CanvasText] forced-colors:shadow-none"
        >
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-center">
            <div>
              <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
                Story opponent 1 of 23
              </p>
              <h1
                className="font-display text-mapachito-charcoal mt-4 text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.86] font-black tracking-[-0.035em] text-balance uppercase font-stretch-condensed"
                id="standard-story-title"
              >
                Standard Story
              </h1>
              <p className="text-mapachito-charcoal mt-6 max-w-2xl text-base leading-[1.65] font-semibold opacity-82">
                Your first animal challenge is a complete local game of Standard
                chess. The 100-Elo target stays explicitly provisional while
                calibration and human playtesting continue.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="border-mapachito-charcoal bg-mapachito-raspberry text-mapachito-white shadow-mapachito-orange grid min-h-52 place-content-center rounded-[1.25rem_0.25rem_1.25rem_0.25rem] border-3 bg-[linear-gradient(135deg,transparent_0_48%,color-mix(in_srgb,var(--color-mapachito-white)_22%,transparent)_48%_52%,transparent_52%)] p-6 text-center shadow-[0.5rem_0.5rem_0]"
            >
              <span className="font-display text-[clamp(5rem,18vw,9rem)] leading-[0.72] font-black tracking-[-0.06em]">
                01
              </span>
              <span className="mt-4 font-mono text-xs font-black tracking-[0.18em] uppercase">
                First opponent
              </span>
            </div>
          </div>

          <article className="mt-9 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <h2 className="font-display text-mapachito-charcoal text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase">
                Chicken Stockfish
              </h2>
              <dl className="border-mapachito-charcoal bg-mapachito-white [&>div+div]:border-mapachito-charcoal/18 [&_dt]:text-mapachito-charcoal [&_dd]:text-mapachito-charcoal mt-4 overflow-hidden rounded-[1rem_0.25rem_1rem_0.25rem] border-3 [&_dd]:font-black [&_dt]:text-[0.72rem] [&_dt]:font-black [&_dt]:tracking-[0.12em] [&_dt]:uppercase [&_dt]:opacity-72 [&>div+div]:border-t-2">
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
                  <dd>
                    Provisional {STANDARD_CHICKEN_PROVISIONAL_TARGET_ELO}-Elo
                    target
                  </dd>
                </div>
              </dl>
            </div>
            <MapachessButton
              onClick={() =>
                actor.send({ type: "WEB_MATCH_SESSION.MATCH_REQUESTED" })
              }
              type="button"
            >
              Play Chicken Stockfish
            </MapachessButton>
          </article>
        </section>
      ) : snapshot.matches("active") && session !== null ? (
        <StandardChickenMatch
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
        className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal grid min-h-[min(74dvh,50rem)] place-items-center rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-8 text-center shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
      >
        <h1 className="font-display text-mapachito-charcoal text-[clamp(1.75rem,5vw,3rem)] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase">
          Opening Mapachess…
        </h1>
      </section>
    </GameFrame>
  )
}

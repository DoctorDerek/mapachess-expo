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
import StandardChickenMatch from "./StandardChickenMatch"

type WebMatchSessionActor = ActorRefFrom<typeof webMatchSessionMachine>

const secondaryControlClasses =
  "min-h-11 rounded-xl border border-white/15 bg-slate-900/75 px-4 py-2 font-bold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"

const primaryControlClasses =
  "min-h-12 rounded-xl border border-cyan-300/40 bg-cyan-300 px-5 py-3 font-black text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:ring-4 focus-visible:ring-amber-300 focus-visible:outline-none"

const retryControlClasses =
  "min-h-12 rounded-xl border border-amber-300/35 bg-amber-300/10 px-5 py-3 font-bold text-amber-100 transition-colors hover:bg-amber-300/20 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"

export type StandardChickenGameProps = Readonly<{
  onSettingsRequested: () => void
  profileActor: ActorRefFrom<typeof profileMachine>
  settingsButtonRef: Ref<HTMLButtonElement>
  settingsOpen: boolean
}>

type GameFrameProps = Omit<StandardChickenGameProps, "profileActor"> &
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
    <div className="relative isolate min-h-dvh overflow-hidden px-[clamp(1rem,3vw,3rem)] py-[clamp(1.25rem,4vw,3rem)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.11),transparent_38%),linear-gradient(145deg,#07121e_0%,#0d1726_48%,#171128_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[8%] top-[9%] -z-10 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent"
      />

      <header className="mx-auto mb-[clamp(1.25rem,3vw,2.5rem)] flex w-full max-w-[96rem] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.24em] text-cyan-200 uppercase">
            Standard Story
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Play locally against an animal Stockfish opponent. Current strength
            labels are provisional until calibration is complete; rating and
            progression changes are not enabled yet.
          </p>
        </div>
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
  onSettingsRequested,
  settingsButtonRef,
  settingsOpen,
}: Omit<StandardChickenGameProps, "profileActor"> &
  Readonly<{ actor: WebMatchSessionActor }>) {
  const snapshot = useSelector(actor, (current) => current)
  const session = selectWebMatchSession(snapshot)
  const failure = selectWebMatchSessionFailure(snapshot)

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
          className="mx-auto max-w-4xl rounded-3xl border border-white/12 bg-slate-950/72 p-[clamp(1.5rem,5vw,3.5rem)] shadow-[0_1.5rem_5rem_rgba(2,6,23,0.4)] backdrop-blur-xl"
        >
          <p className="font-mono text-xs font-bold tracking-[0.2em] text-amber-200 uppercase">
            Choose an opponent
          </p>
          <h1
            className="mt-3 text-[clamp(2.25rem,7vw,4.5rem)] leading-none font-black tracking-[-0.05em] text-white"
            id="standard-story-title"
          >
            Standard Story
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-slate-300">
            Chicken Stockfish is the first playable animal opponent. Its 100-Elo
            target remains explicitly provisional while seeded calibration and
            human playtesting continue.
          </p>

          <article className="mt-8 flex flex-col gap-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs font-bold tracking-[0.16em] text-amber-200 uppercase">
                Story opponent 1 of 23
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Chicken Stockfish
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Standard chess · untimed · provisional 100-Elo target
              </p>
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
          runtime={session.runtime}
        />
      ) : snapshot.matches("failed") && failure !== null ? (
        <section
          aria-live="assertive"
          className="grid min-h-[min(74dvh,50rem)] place-items-center rounded-3xl border border-white/12 bg-slate-950/72 p-8 text-center shadow-[0_1.5rem_5rem_rgba(2,6,23,0.4)] backdrop-blur-xl"
        >
          <div role="alert">
            <h1 className="text-2xl font-black text-white">
              {failureTitle(failure.operation)}
            </h1>
            <p className="mt-3 max-w-lg text-slate-400">
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
          className="grid min-h-[min(74dvh,50rem)] place-items-center rounded-3xl border border-white/12 bg-slate-950/72 p-8 text-center shadow-[0_1.5rem_5rem_rgba(2,6,23,0.4)] backdrop-blur-xl"
        >
          <div role="status">
            <div
              aria-hidden="true"
              className="mx-auto size-12 animate-spin rounded-full border-4 border-cyan-200/20 border-t-cyan-200 motion-reduce:animate-none"
            />
            <h1 className="mt-5 text-2xl font-black text-white">
              {openingTitle(actor)}
            </h1>
            <p className="mt-3 text-slate-400">
              Loading the pinned local engine and validating its identity.
            </p>
          </div>
        </section>
      )}
    </GameFrame>
  )
}

export default function StandardChickenGame({
  profileActor,
  ...frameProps
}: StandardChickenGameProps) {
  const [sessionActor, setSessionActor] = useState<WebMatchSessionActor | null>(
    null,
  )

  useEffect(() => {
    const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
    if (playerData?.firstRun.autoHintsChoiceCompleted !== true) {
      throw new Error("A completed player profile is required to enter play.")
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
    return <MatchSessionExperience actor={sessionActor} {...frameProps} />
  }

  return (
    <GameFrame matchSessionActive={false} {...frameProps}>
      <section
        aria-live="polite"
        className="grid min-h-[min(74dvh,50rem)] place-items-center rounded-3xl border border-white/12 bg-slate-950/72 p-8 text-center"
      >
        <h1 className="text-2xl font-black text-white">Opening Mapachess…</h1>
      </section>
    </GameFrame>
  )
}

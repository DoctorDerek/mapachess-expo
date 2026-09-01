"use client"

import { useEffect, useState, type Ref } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import bindMatchPositionEvaluation, {
  type MatchPositionEvaluationBinding,
} from "@mapachess/evaluation/match-position-evaluation"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import matchMachine from "@mapachess/match/match-machine"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import ProfileMatchPersistenceBridge from "@mapachess/profile/profile-match-persistence"
import openStandardChickenRuntime, {
  type StandardChickenRuntime,
} from "../../lib/chicken/openStandardChickenRuntime"
import resumeStandardChickenMatch, {
  buildFreshStandardChickenMatch,
} from "../../lib/chicken/standardChickenDurableMatch"
import StandardChickenMatch from "./StandardChickenMatch"

type PlaytestRuntimeState =
  | Readonly<{ status: "opening" }>
  | Readonly<{
      actor: ActorRefFrom<typeof matchMachine>
      evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
      match: DurableMatchRecord
      runtime: StandardChickenRuntime
      status: "ready"
    }>
  | Readonly<{ status: "failed" }>

const retryButtonClasses =
  "min-h-12 rounded-xl border border-amber-300/35 bg-amber-300/10 px-5 py-3 font-bold text-amber-100 transition-colors hover:bg-amber-300/20 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"

export type StandardChickenPlaytestProps = Readonly<{
  onSettingsRequested: () => void
  profileActor: ActorRefFrom<typeof profileMachine>
  settingsButtonRef: Ref<HTMLButtonElement>
  settingsOpen: boolean
}>

export default function StandardChickenPlaytest({
  onSettingsRequested,
  profileActor,
  settingsButtonRef,
  settingsOpen,
}: StandardChickenPlaytestProps) {
  const [attempt, setAttempt] = useState(0)
  const [runtimeState, setRuntimeState] = useState<PlaytestRuntimeState>({
    status: "opening",
  })

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let evaluationActor: ActorRefFrom<typeof positionEvaluationMachine> | null =
      null
    let evaluationBinding: MatchPositionEvaluationBinding | null = null
    let matchActor: ActorRefFrom<typeof matchMachine> | null = null
    let openedRuntime: StandardChickenRuntime | null = null

    setRuntimeState({ status: "opening" })
    void (async () => {
      const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
      if (playerData?.firstRun.autoHintsChoiceCompleted !== true) {
        throw new Error("Chicken runtime requires a completed player profile.")
      }

      const expectedActiveMatch = playerData.activeMatch
      const savedMatch =
        expectedActiveMatch === null
          ? null
          : resumeStandardChickenMatch(expectedActiveMatch)
      const runtime = await openStandardChickenRuntime(
        savedMatch === null
          ? { signal: controller.signal }
          : { matchSeed: savedMatch.matchSeed, signal: controller.signal },
      )
      openedRuntime = runtime
      const activeMatch =
        expectedActiveMatch ??
        buildFreshStandardChickenMatch({
          autoHintsEnabledAtStart: playerData.settings.autoHintsEnabled,
          playerEloAtStart: playerData.ratings.standardStory,
          runtime,
        })
      const resumedMatch = savedMatch ?? resumeStandardChickenMatch(activeMatch)
      const persistence = new ProfileMatchPersistenceBridge({
        actor: profileActor,
        expectedActiveMatch,
        initialMatch: activeMatch,
      })
      await persistence.establish(controller.signal)

      if (disposed) {
        await runtime.close().catch(() => undefined)
        openedRuntime = null
        return
      }

      matchActor = createActor(matchMachine, {
        input: {
          autoHintsEnabled: activeMatch.autoHintsEnabledAtStart,
          durability: { persistence, type: "durable" },
          hintAnalyst: runtime.hintAnalyst,
          matchId: activeMatch.matchId,
          opponent: runtime.opponent,
          playerColor: activeMatch.playerColor,
          resumedState: {
            moveHintsUsed: activeMatch.moveHintsUsed,
            pieceHintsUsed: activeMatch.pieceHintsUsed,
            timeline: resumedMatch.timeline,
          },
        },
      }).start()
      evaluationActor = createActor(positionEvaluationMachine, {
        input: { evaluator: runtime.positionEvaluator },
      }).start()
      evaluationBinding = bindMatchPositionEvaluation(
        matchActor,
        evaluationActor,
      )
      setRuntimeState({
        actor: matchActor,
        evaluationActor,
        match: activeMatch,
        runtime,
        status: "ready",
      })
    })().catch(async () => {
      evaluationBinding?.disconnect()
      evaluationActor?.stop()
      matchActor?.stop()
      if (openedRuntime !== null) {
        await openedRuntime.close().catch(() => undefined)
        openedRuntime = null
      }
      if (!disposed && !controller.signal.aborted) {
        setRuntimeState({ status: "failed" })
      }
    })

    return () => {
      disposed = true
      evaluationBinding?.disconnect()
      evaluationActor?.stop()
      matchActor?.stop()
      controller.abort()
      if (openedRuntime !== null) {
        void openedRuntime.close().catch(() => undefined)
      }
    }
  }, [attempt, profileActor])

  const currentPlayerData = selectCurrentPlayerData(profileActor.getSnapshot())
  const autoHintsEnabledAtStart =
    runtimeState.status === "ready"
      ? runtimeState.match.autoHintsEnabledAtStart
      : (currentPlayerData?.activeMatch?.autoHintsEnabledAtStart ??
        currentPlayerData?.settings.autoHintsEnabled ??
        true)

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
            Private engine proof
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            A local-only Standard match against a provisional Chicken policy.{" "}
            {autoHintsEnabledAtStart
              ? "Auto-Hints demonstrate Piece Hints followed by Move Hints on every player turn."
              : "Auto-Hints are off; Better Hints remain available on request."}{" "}
            No rating, progression, or public Elo claim is recorded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/12 bg-slate-950/60 px-3 py-1.5 font-mono text-xs text-slate-300">
            Stockfish runs on this device
          </span>
          <button
            aria-controls="profile-settings-panel"
            aria-expanded={settingsOpen}
            className="min-h-11 rounded-xl border border-white/15 bg-slate-900/75 px-4 py-2 font-bold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"
            onClick={onSettingsRequested}
            ref={settingsButtonRef}
            type="button"
          >
            Settings
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[96rem]">
        {runtimeState.status === "ready" ? (
          <StandardChickenMatch
            actor={runtimeState.actor}
            runtime={runtimeState.runtime}
          />
        ) : (
          <section
            aria-live="polite"
            className="grid min-h-[min(74dvh,50rem)] place-items-center rounded-3xl border border-white/12 bg-slate-950/72 p-8 text-center shadow-[0_1.5rem_5rem_rgba(2,6,23,0.4)] backdrop-blur-xl"
          >
            {runtimeState.status === "opening" ? (
              <div role="status">
                <div
                  aria-hidden="true"
                  className="mx-auto size-12 animate-spin rounded-full border-4 border-cyan-200/20 border-t-cyan-200 motion-reduce:animate-none"
                />
                <h1 className="mt-5 text-2xl font-black text-white">
                  Opening Chicken Stockfish…
                </h1>
                <p className="mt-3 text-slate-400">
                  Loading the pinned local engine and validating its identity.
                </p>
              </div>
            ) : (
              <div role="alert">
                <h1 className="text-2xl font-black text-white">
                  Your Chicken match could not open.
                </h1>
                <p className="mt-3 max-w-lg text-slate-400">
                  Your verified local profile remains available. Retry the local
                  save handshake and Stockfish boot.
                </p>
                <button
                  className={`${retryButtonClasses} mt-6`}
                  onClick={() => setAttempt((current) => current + 1)}
                  type="button"
                >
                  Retry match opening
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import matchMachine from "@mapachess/match/match-machine"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import openStandardChickenRuntime, {
  type StandardChickenRuntime,
} from "../../lib/chicken/openStandardChickenRuntime"
import StandardChickenMatch from "./StandardChickenMatch"

type PlaytestRuntimeState =
  | Readonly<{ status: "opening" }>
  | Readonly<{
      actor: ActorRefFrom<typeof matchMachine>
      runtime: StandardChickenRuntime
      status: "ready"
    }>
  | Readonly<{ status: "failed" }>

const retryButtonClasses =
  "min-h-12 rounded-xl border border-amber-300/35 bg-amber-300/10 px-5 py-3 font-bold text-amber-100 transition-colors hover:bg-amber-300/20 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"

export default function StandardChickenPlaytest() {
  const [attempt, setAttempt] = useState(0)
  const [runtimeState, setRuntimeState] = useState<PlaytestRuntimeState>({
    status: "opening",
  })

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let matchActor: ActorRefFrom<typeof matchMachine> | null = null
    let openedRuntime: StandardChickenRuntime | null = null

    setRuntimeState({ status: "opening" })
    void openStandardChickenRuntime({ signal: controller.signal })
      .then((runtime) => {
        openedRuntime = runtime
        if (disposed) {
          return runtime.close().catch(() => undefined)
        }

        matchActor = createActor(matchMachine, {
          input: {
            autoHintsEnabled: false,
            initialPosition: createInitialMatchPosition({
              chess960PositionId: null,
              variant: "standard",
            }),
            hintAnalyst: runtime.hintAnalyst,
            matchId: runtime.matchId,
            opponent: runtime.opponent,
            playerColor: runtime.playerColor,
          },
        }).start()
        setRuntimeState({ actor: matchActor, runtime, status: "ready" })
      })
      .catch(async () => {
        if (!disposed && !controller.signal.aborted) {
          matchActor?.stop()
          await openedRuntime?.close().catch(() => undefined)
          openedRuntime = null
          if (!disposed && !controller.signal.aborted) {
            setRuntimeState({ status: "failed" })
          }
        }
      })

    return () => {
      disposed = true
      matchActor?.stop()
      controller.abort()
      if (openedRuntime !== null) {
        void openedRuntime.close().catch(() => undefined)
      }
    }
  }, [attempt])

  return (
    <main className="relative isolate min-h-dvh overflow-hidden px-[clamp(1rem,3vw,3rem)] py-[clamp(1.25rem,4vw,3rem)]">
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
            A local-only Standard match against a provisional Chicken policy. No
            rating, progression, or public Elo claim is recorded.
          </p>
        </div>
        <span className="rounded-full border border-white/12 bg-slate-950/60 px-3 py-1.5 font-mono text-xs text-slate-300">
          Stockfish runs on this device
        </span>
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
                  Chicken Stockfish could not open.
                </h1>
                <p className="mt-3 max-w-lg text-slate-400">
                  Your game data is unchanged. Confirm the local Stockfish files
                  are provisioned, then try again.
                </p>
                <button
                  className={`${retryButtonClasses} mt-6`}
                  onClick={() => setAttempt((current) => current + 1)}
                  type="button"
                >
                  Retry engine boot
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

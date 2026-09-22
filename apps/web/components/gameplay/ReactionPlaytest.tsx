"use client"

import { useActorRef, useSelector } from "@xstate/react"
import { createContext, useContext, useEffect, type ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import reactionPlaytestMachine from "../../lib/presentation/reactionPlaytestMachine"
import MapachessButton from "../presentation/MapachessButton"

const ReactionPlaytestContext = createContext<ActorRefFrom<
  typeof reactionPlaytestMachine
> | null>(null)

export const useReactionPlaytest = () => useContext(ReactionPlaytestContext)

export default function ReactionPlaytest({
  children,
}: Readonly<{ children: ReactNode }>) {
  const actor = useActorRef(reactionPlaytestMachine)
  useEffect(() => {
    const clearWhenHidden = (): void => {
      if (document.hidden) actor.send({ type: "DEMO.RESET" })
    }
    document.addEventListener("visibilitychange", clearWhenHidden)
    return () =>
      document.removeEventListener("visibilitychange", clearWhenHidden)
  }, [actor])
  return (
    <ReactionPlaytestContext value={actor}>{children}</ReactionPlaytestContext>
  )
}

export function ReactionPlaytestControls() {
  const actor = useReactionPlaytest()
  return actor === null ? null : <PlaytestControls actor={actor} />
}

function PlaytestControls({
  actor,
}: Readonly<{ actor: ActorRefFrom<typeof reactionPlaytestMachine> }>) {
  const durationMs = useSelector(
    actor,
    (snapshot) => snapshot.context.durationMs,
  )
  return (
    <section
      aria-label="Reaction playtest"
      className="grid gap-3 border-t border-white/30 pt-3 text-base text-white"
    >
      <strong>Reaction demo · not move analysis</strong>
      <p>
        Samples do not rate your moves or enter history. One pending sample;
        newer samples replace it. Changing duration clears the demo.
      </p>
      <fieldset className="flex gap-3">
        <legend>Dismiss after</legend>
        {([3000, 5000] as const).map((duration) => (
          <label key={duration} className="flex min-h-12 items-center gap-2">
            <input
              type="radio"
              name="reaction-duration"
              checked={durationMs === duration}
              onChange={() =>
                actor.send({
                  type: "DEMO.DURATION_CHANGED",
                  durationMs: duration,
                })
              }
            />
            {duration / 1000} seconds
          </label>
        ))}
      </fieldset>
      <MapachessButton
        variant="secondary"
        onClick={(event) => {
          actor.send({ type: "DEMO.RESET" })
          actor.send({
            type: "DEMO.SAMPLE_REQUESTED",
            sample: { mover: "White", label: "Blunder!" },
          })
          actor.send({
            type: "DEMO.SAMPLE_REQUESTED",
            sample: { mover: "Black", label: "Genius!" },
          })
          event.currentTarget.closest("details")?.removeAttribute("open")
        }}
      >
        Demo rapid pair
      </MapachessButton>
      <MapachessButton
        variant="secondary"
        onClick={() => actor.send({ type: "DEMO.RESET" })}
      >
        Clear demo
      </MapachessButton>
    </section>
  )
}

export function ReactionPlaytestBadge() {
  const actor = useReactionPlaytest()
  return actor === null ? null : <PlaytestBadge actor={actor} />
}

function PlaytestBadge({
  actor,
}: Readonly<{ actor: ActorRefFrom<typeof reactionPlaytestMachine> }>) {
  const current = useSelector(actor, (snapshot) => snapshot.context.current)
  return current === null ? null : (
    <button
      type="button"
      aria-label={`Demo: ${current.mover} ${current.label} Dismiss reaction`}
      onClick={() => actor.send({ type: "DEMO.DISMISSED" })}
      className="bg-mapachito-violet relative z-20 min-h-12 max-w-full rounded px-2 py-1 text-center text-base font-bold text-white focus-visible:outline-2"
    >
      <span className="block text-xs">Demo</span>
      <span role="status">
        {current.mover} · {current.label}
      </span>
    </button>
  )
}

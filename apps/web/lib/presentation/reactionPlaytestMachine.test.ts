import { afterEach, describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import reactionPlaytestMachine from "./reactionPlaytestMachine"

afterEach(() => vi.useRealTimers())

describe("reaction playtest queue", () => {
  it.each([3000, 5000] as const)(
    "gives each queued sample its own %i milliseconds",
    (durationMs) => {
      vi.useFakeTimers()
      const actor = createActor(reactionPlaytestMachine).start()
      actor.send({ type: "DEMO.DURATION_CHANGED", durationMs })
      actor.send({
        type: "DEMO.SAMPLE_REQUESTED",
        sample: { mover: "White", label: "Blunder!" },
      })
      actor.send({
        type: "DEMO.SAMPLE_REQUESTED",
        sample: { mover: "Black", label: "Genius!" },
      })
      vi.advanceTimersByTime(durationMs - 1)
      expect(actor.getSnapshot().context.current?.mover).toBe("White")
      vi.advanceTimersByTime(1)
      expect(actor.getSnapshot().context.current?.mover).toBe("Black")
      vi.advanceTimersByTime(durationMs)
      expect(actor.getSnapshot().matches("idle")).toBe(true)
      expect(actor.getSnapshot().context.current).toBeNull()
      actor.stop()
    },
  )
  it("keeps only the newest pending sample and advances on dismissal", () => {
    const actor = createActor(reactionPlaytestMachine).start()
    actor.send({
      type: "DEMO.SAMPLE_REQUESTED",
      sample: { mover: "White", label: "Blunder!" },
    })
    actor.send({
      type: "DEMO.SAMPLE_REQUESTED",
      sample: { mover: "Black", label: "Genius!" },
    })
    actor.send({
      type: "DEMO.SAMPLE_REQUESTED",
      sample: { mover: "Black", label: "Blunder!" },
    })
    actor.send({ type: "DEMO.DISMISSED" })
    expect(actor.getSnapshot().context.current).toEqual({
      mover: "Black",
      label: "Blunder!",
    })
    expect(actor.getSnapshot().context.pending).toBeNull()
    actor.stop()
  })
  it("cancels timers and pending samples on reset", () => {
    vi.useFakeTimers()
    const actor = createActor(reactionPlaytestMachine).start()
    actor.send({
      type: "DEMO.SAMPLE_REQUESTED",
      sample: { mover: "White", label: "Blunder!" },
    })
    actor.send({
      type: "DEMO.SAMPLE_REQUESTED",
      sample: { mover: "Black", label: "Genius!" },
    })
    actor.send({ type: "DEMO.RESET" })
    vi.advanceTimersByTime(10000)
    expect(actor.getSnapshot().context.current).toBeNull()
    expect(actor.getSnapshot().context.pending).toBeNull()
    actor.stop()
  })
})

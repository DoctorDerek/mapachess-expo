import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createActor, type ActorRefFrom } from "xstate"
import { parseChess960PositionId } from "../src/chess960Position.js"
import { durableMatchClock } from "../src/matchClock.js"
import matchMachine, {
  selectCanRedo,
  selectCanUndo,
  selectMatchPosition,
} from "../src/matchMachine.js"
import type { MatchMoveId } from "../src/matchMove.js"
import type { MatchPersistence } from "../src/matchPersistence.js"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "../src/matchPosition.js"
import {
  TIME_CONTROL_PRESETS,
  timeCategory,
  type TimeControl,
} from "../src/timeControl.js"
import { createHintResult, requireLegalMove } from "./matchTestUtils.js"

const BULLET: TimeControl = {
  type: "fischer",
  baseSeconds: 60,
  incrementSeconds: 0,
}
const BLITZ: TimeControl = {
  type: "fischer",
  baseSeconds: 180,
  incrementSeconds: 2,
}
const standard = createInitialMatchPosition({
  variant: "standard",
  chess960PositionId: null,
})
const actors: ActorRefFrom<typeof matchMachine>[] = []

function startTimed(
  control = BULLET,
  persistence?: MatchPersistence,
  autoHints = false,
) {
  let now = 0
  let reply: ((move: MatchMoveId) => void) | undefined
  const actor = createActor(matchMachine, {
    input: {
      timeControl: control,
      monotonicClock: { now: () => now },
      autoHintMode: autoHints ? "auto-move-hints" : "no-auto-hints",
      ...(autoHints
        ? {
            hintAnalyst: {
              analyze: async (
                request: Parameters<typeof createHintResult>[0],
              ) => createHintResult(request),
            },
          }
        : {}),
      durability:
        persistence === undefined
          ? { type: "ephemeral" }
          : { type: "durable", persistence },
      initialPosition: standard,
      matchId: "timed-test",
      playerColor: "white",
      opponent: {
        selectMove: () =>
          new Promise<MatchMoveId>((resolve) => {
            reply = resolve
          }),
      },
    },
  }).start()
  actors.push(actor)
  return {
    actor,
    setTime: (value: number): void => {
      now = value
    },
    reply: (uci: string): void => {
      reply?.(
        requireLegalMove(selectMatchPosition(actor.getSnapshot()), uci).id,
      )
    },
    move: (uci: string): void =>
      actor.send({
        type: "MATCH.MOVE_REQUESTED",
        moveId: requireLegalMove(selectMatchPosition(actor.getSnapshot()), uci)
          .id,
      }),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  for (const actor of actors.splice(0)) actor.stop()
  vi.useRealTimers()
})

describe("timed chess accepted-state integration", () => {
  it.each(TIME_CONTROL_PRESETS)(
    "classifies $id without pre-crediting increments",
    ({ id, control }) => {
      expect(timeCategory(control)).toBe(
        id === "untimed"
          ? "untimed"
          : id === "1+0" || id === "2+1"
            ? "bullet"
            : id === "10+0"
              ? "rapid"
              : "blitz",
      )
    },
  )

  it("rejects a move at the deadline even before the timer callback runs", () => {
    const game = startTimed()
    game.setTime(60_000)
    game.move("e2e4")
    expect(game.actor.getSnapshot().context.timeline.cursor).toBe(0)
    expect(game.actor.getSnapshot().context.conclusion).toEqual({
      type: "timeout",
      winner: "black",
    })
    expect(game.actor.getSnapshot().context.clock?.remainingMs.white).toBe(0)
  })

  it("expires autonomously and restores the same playable initial position on Undo", async () => {
    const game = startTimed()
    game.setTime(60_000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(game.actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectCanUndo(game.actor.getSnapshot())).toBe(true)
    game.actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(game.actor.getSnapshot().matches("paused")).toBe(true)
    expect(game.actor.getSnapshot().context.clock?.remainingMs.white).toBe(
      60_000,
    )
    expect(game.actor.getSnapshot().context.timeline.cursor).toBe(0)
    expect(selectCanRedo(game.actor.getSnapshot())).toBe(true)
    game.actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(game.actor.getSnapshot().matches("complete")).toBe(true)
    expect(game.actor.getSnapshot().context.clock?.remainingMs.white).toBe(0)
    game.actor.send({ type: "MATCH.UNDO_REQUESTED" })
    game.actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
    game.move("e2e4")
    expect(game.actor.getSnapshot().context.conclusion).toBeNull()
    expect(game.actor.getSnapshot().context.retainedConclusion).toBeNull()
  })

  it("settles thinking time and grants each increment once, not on Redo", async () => {
    const game = startTimed(BLITZ)
    game.setTime(3_000)
    game.move("e2e4")
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 179_000,
      black: 180_000,
    })
    game.setTime(4_000)
    game.reply("e7e5")
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 179_000,
      black: 181_000,
    })
    game.actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 180_000,
      black: 180_000,
    })
    game.actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 179_000,
      black: 181_000,
    })
    expect(game.actor.getSnapshot().matches("paused")).toBe(true)
  })

  it("rejects an engine move returned after the opponent flags", async () => {
    const game = startTimed()
    game.move("e2e4")
    game.setTime(60_001)
    game.reply("e7e5")
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().context.timeline.cursor).toBe(1)
    expect(game.actor.getSnapshot().context.conclusion).toEqual({
      type: "timeout",
      winner: "white",
    })
    game.actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(game.actor.getSnapshot().context.timeline.cursor).toBe(1)
    expect(game.actor.getSnapshot().context.clock?.remainingMs.black).toBe(
      60_000,
    )
  })

  it("does not charge save latency to either participant", async () => {
    let acknowledge: (() => void) | undefined
    const game = startTimed(BLITZ, {
      persist: (request) =>
        new Promise((resolve) => {
          acknowledge = () =>
            resolve({
              requestId: request.requestId,
              type: "MATCH.MUTATION_PERSISTED",
            })
        }),
    })
    game.setTime(1_000)
    game.move("e2e4")
    expect(game.actor.getSnapshot().matches("persistingMutation")).toBe(true)
    game.setTime(90_000)
    acknowledge?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 181_000,
      black: 180_000,
    })
    expect(game.actor.getSnapshot().context.clock?.startedAt).toBe(90_000)
    game.setTime(91_000)
    game.reply("e7e5")
    await vi.advanceTimersByTimeAsync(0)
    expect(
      game.actor.getSnapshot().context.pendingMutation?.clock?.remainingMs
        .black,
    ).toBe(181_000)
  })

  it("durably latches a background pause after a pending save until explicit Resume", async () => {
    let acknowledge: (() => void) | undefined
    const recordedPauseStates: boolean[] = []
    const game = startTimed(BULLET, {
      persist: (request) =>
        new Promise((resolve) => {
          if (request.clock != null)
            recordedPauseStates.push(request.clock.paused)
          acknowledge = () =>
            resolve({
              requestId: request.requestId,
              type: "MATCH.MUTATION_PERSISTED",
            })
        }),
    })
    game.move("e2e4")
    game.actor.send({ type: "MATCH.CLOCK_PAUSE_REQUESTED" })
    game.setTime(600_000)
    acknowledge?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().matches("persistingMutation")).toBe(true)
    expect(recordedPauseStates).toEqual([false, true])
    acknowledge?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().matches("paused")).toBe(true)
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 60_000,
      black: 60_000,
    })
    game.actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
    expect(game.actor.getSnapshot().matches("opponentThinking")).toBe(true)
    expect(game.actor.getSnapshot().context.clock?.startedAt).toBe(600_000)
  })

  it("freezes a failed save and keeps a successful retry paused", async () => {
    let fail = true
    const game = startTimed(BLITZ, {
      persist: async (request) => {
        if (fail) throw new Error("Storage unavailable")
        return {
          requestId: request.requestId,
          type: "MATCH.MUTATION_PERSISTED",
        }
      },
    })
    game.setTime(1_000)
    game.move("e2e4")
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().matches("persistenceFailure")).toBe(true)
    game.setTime(900_000)
    fail = false
    game.actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
    await vi.advanceTimersByTimeAsync(0)
    expect(game.actor.getSnapshot().matches("paused")).toBe(true)
    expect(game.actor.getSnapshot().context.clock?.remainingMs).toEqual({
      white: 181_000,
      black: 180_000,
    })
    game.actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
    expect(game.actor.getSnapshot().context.clock?.startedAt).toBe(900_000)
  })

  it("charges pending hint analysis without blocking a legal move", async () => {
    let now = 0
    const actor = createActor(matchMachine, {
      input: {
        timeControl: BULLET,
        monotonicClock: { now: () => now },
        autoHintMode: "auto-move-hints",
        hintAnalyst: { analyze: () => new Promise(() => undefined) },
        durability: { type: "ephemeral" },
        initialPosition: standard,
        matchId: "slow-hints",
        playerColor: "white",
        opponent: { selectMove: () => new Promise(() => undefined) },
      },
    }).start()
    actors.push(actor)
    expect(actor.getSnapshot().matches({ playerTurn: "analyzing" })).toBe(true)
    now = 5_000
    actor.send({
      type: "MATCH.MOVE_REQUESTED",
      moveId: requireLegalMove(standard, "e2e4").id,
    })
    expect(actor.getSnapshot().context.timeline.cursor).toBe(1)
    expect(actor.getSnapshot().context.clock?.remainingMs.white).toBe(55_000)
  })

  it("keeps Auto-Move Hints nonblocking and charges time while they are visible", async () => {
    const game = startTimed(BULLET, undefined, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(
      game.actor.getSnapshot().matches({ playerTurn: "moveHintsVisible" }),
    ).toBe(true)
    game.setTime(7_000)
    game.move("e2e4")
    expect(game.actor.getSnapshot().context.clock?.remainingMs.white).toBe(
      53_000,
    )
    expect(game.actor.getSnapshot().context.moveHintsUsed).toBe(true)
  })

  it("does not restart clocks automatically when a paused actor is persisted and reconstructed", () => {
    const game = startTimed()
    game.setTime(2_500)
    game.actor.send({ type: "MATCH.CLOCK_PAUSE_REQUESTED" })
    const snapshot = game.actor.getSnapshot()
    const record = durableMatchClock(snapshot.context.clock)
    const resumed = createActor(matchMachine, {
      input: {
        matchId: "resumed",
        timeControl: BULLET,
        monotonicClock: { now: () => 900_000 },
        autoHintMode: "no-auto-hints",
        playerColor: "white",
        opponent: { selectMove: () => new Promise(() => undefined) },
        durability: {
          type: "durable",
          persistence: {
            persist: async (request) => ({
              type: "MATCH.MUTATION_PERSISTED",
              requestId: request.requestId,
            }),
          },
        },
        resumedState: {
          clock: record,
          conclusion: null,
          moveHintsUsed: false,
          pieceHintsUsed: false,
          timeline: snapshot.context.timeline,
        },
      },
    }).start()
    actors.push(resumed)
    expect(resumed.getSnapshot().matches("paused")).toBe(true)
    expect(resumed.getSnapshot().context.clock?.remainingMs.white).toBe(57_500)
    expect(JSON.stringify(record)).not.toContain("startedAt")
  })

  it.each(["standard", "chess960"] as const)(
    "adjudicates side-specific material in %s without a fake move",
    (variant) => {
      const numbered = parseChess960PositionId(518)
      if (!numbered.ok) throw new Error("Fixture must parse")
      const position = reconstructMatchPosition(
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: numbered.positionId },
        "7k/8/8/8/8/8/P7/K7 w - - 0 1",
      )
      if (!position.ok) throw new Error("Fixture must reconstruct")
      let now = 0
      const actor = createActor(matchMachine, {
        input: {
          timeControl: BULLET,
          monotonicClock: { now: () => now },
          autoHintMode: "no-auto-hints",
          durability: { type: "ephemeral" },
          initialPosition: position.position,
          matchId: variant,
          playerColor: "white",
          opponent: { selectMove: () => new Promise(() => undefined) },
        },
      })
      actor.start()
      actors.push(actor)
      now = 60_000
      actor.send({ type: "MATCH.CLOCK_EXPIRED" })
      expect(actor.getSnapshot().context.conclusion).toEqual({
        type: "timeout-insufficient-material",
      })
      expect(actor.getSnapshot().context.timeline.cursor).toBe(0)
    },
  )
})

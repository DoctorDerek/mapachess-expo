import { describe, expect, it } from "vitest"
import { createActor, SimulatedClock } from "xstate"
import type { MatchColor } from "@mapachess/match/match-position"
import {
  MOVE_CLASSIFICATION_POLICY_ID,
  type MoveClassificationGrade,
} from "../src/moveClassification.js"
import moveReactionMachine, {
  MOVE_REACTION_DURATION_MS,
  selectMoveReactionWaitingCounts,
  type MoveReaction,
} from "../src/moveReactionMachine.js"

const reaction = (
  id: string,
  grade: MoveClassificationGrade = "good",
  mover: MatchColor = "white",
): MoveReaction => ({
  id,
  mover,
  san: "e4",
  classification: {
    grade,
    reason: null,
    policyId: MOVE_CLASSIFICATION_POLICY_ID,
  },
})

const open = () => {
  const clock = new SimulatedClock()
  const actor = createActor(moveReactionMachine, { clock }).start()
  const receive = (value: MoveReaction) =>
    actor.send({ type: "MOVE_REACTION.RECEIVED", reaction: value })
  const present = (id: string) =>
    actor.send({ type: "MOVE_REACTION.PRESENTED", id })
  return { clock, actor, receive, present }
}

describe("ordered move reactions", () => {
  it("gives each visible reaction its own full five seconds", () => {
    const { actor, clock, receive, present } = open()
    receive(reaction("first"))
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().context.visible?.id).toBe("first")
    present("first")
    clock.increment(4_000)
    receive(reaction("second", "brilliant"))
    present("first")
    clock.increment(999)
    expect(actor.getSnapshot().context.visible?.id).toBe("first")
    clock.increment(1)
    expect(actor.getSnapshot().context.visible?.id).toBe("second")
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().context.visible?.id).toBe("second")
    present("first")
    present("second")
    clock.increment(MOVE_REACTION_DURATION_MS - 1)
    expect(actor.getSnapshot().context.visible?.id).toBe("second")
    clock.increment(1)
    expect(actor.getSnapshot().context.visible).toBeNull()
    actor.stop()
  })

  it("retains every rapid White and Black move without severity replacement", () => {
    const { actor, clock, receive, present } = open()
    const moves = [
      reaction("white/1"),
      reaction("black/1", "best", "black"),
      reaction("white/2", "blunder"),
      reaction("black/2", "brilliant", "black"),
      reaction("white/3", "best"),
      reaction("black/3", "good", "black"),
    ]
    for (const move of moves) receive(move)
    expect(selectMoveReactionWaitingCounts(actor.getSnapshot())).toEqual({
      white: 2,
      black: 3,
    })
    for (const move of moves) {
      expect(actor.getSnapshot().context.visible).toEqual(move)
      present(move.id)
      clock.increment(MOVE_REACTION_DURATION_MS)
    }
    expect(actor.getSnapshot().context.visible).toBeNull()
    expect(selectMoveReactionWaitingCounts(actor.getSnapshot())).toEqual({
      white: 0,
      black: 0,
    })
    actor.stop()
  })

  it("ignores duplicate delivery and stale dismissal identities", () => {
    const { actor, clock, receive, present } = open()
    receive(reaction("visible"))
    present("visible")
    receive(reaction("visible"))
    receive(reaction("pending"))
    receive(reaction("pending"))
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "stale" })
    expect(actor.getSnapshot().context.visible?.id).toBe("visible")
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "visible" })
    expect(actor.getSnapshot().context.visible?.id).toBe("pending")
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "visible" })
    present("pending")
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().context.visible).toBeNull()
    receive(reaction("visible"))
    receive(reaction("pending"))
    expect(actor.getSnapshot().context.visible).toBeNull()
    actor.stop()
  })

  it("clears the entire transient queue and cancels its old deadline", () => {
    const { actor, clock, receive, present } = open()
    receive(reaction("visible"))
    present("visible")
    receive(reaction("pending"))
    receive(reaction("pending/2", "good", "black"))
    clock.increment(4_000)
    actor.send({ type: "MOVE_REACTION.CLEARED" })
    expect(actor.getSnapshot().context).toEqual({
      visible: null,
      pending: [],
      receivedIds: [],
    })
    receive(reaction("fresh"))
    present("fresh")
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "visible" })
    clock.increment(1_000)
    expect(actor.getSnapshot().context.visible?.id).toBe("fresh")
    clock.increment(4_000)
    expect(actor.getSnapshot().context.visible).toBeNull()
    actor.stop()
  })

  it("stopping the owner prevents queued feedback from being presented", () => {
    const { actor, clock, receive, present } = open()
    receive(reaction("visible"))
    present("visible")
    receive(reaction("pending"))
    actor.stop()
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().status).toBe("stopped")
    expect(actor.getSnapshot().context.visible?.id).toBe("visible")
  })

  it("derives uncapped waiting-only counts and decrements the advanced color", () => {
    const { actor, receive } = open()
    receive(reaction("visible", "good", "black"))
    for (let index = 0; index < 100; index += 1) {
      receive(reaction(`white/${String(index)}`))
      receive(reaction(`black/${String(index)}`, "good", "black"))
    }
    expect(selectMoveReactionWaitingCounts(actor.getSnapshot())).toEqual({
      white: 100,
      black: 100,
    })
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "visible" })
    expect(actor.getSnapshot().context.visible?.id).toBe("white/0")
    expect(selectMoveReactionWaitingCounts(actor.getSnapshot())).toEqual({
      white: 99,
      black: 100,
    })
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "white/0" })
    expect(actor.getSnapshot().context.visible?.id).toBe("black/0")
    expect(selectMoveReactionWaitingCounts(actor.getSnapshot())).toEqual({
      white: 99,
      black: 99,
    })
    actor.stop()
  })
})

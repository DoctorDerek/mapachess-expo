import { describe, expect, it } from "vitest"
import { createActor, SimulatedClock } from "xstate"
import {
  MOVE_CLASSIFICATION_POLICY_ID,
  type MoveClassificationGrade,
} from "../src/moveClassification.js"
import moveReactionMachine, {
  MOVE_REACTION_DURATION_MS,
  type MoveReaction,
} from "../src/moveReactionMachine.js"

const reaction = (
  id: string,
  grade: MoveClassificationGrade = "good",
): MoveReaction => ({
  id,
  mover: "white",
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
  return { clock, actor, receive }
}

describe("bounded move reactions", () => {
  it("gives each visible reaction its own full five seconds", () => {
    const { actor, clock, receive } = open()
    receive(reaction("first"))
    clock.increment(4_000)
    receive(reaction("second", "brilliant"))
    clock.increment(999)
    expect(actor.getSnapshot().context.visible?.id).toBe("first")
    clock.increment(1)
    expect(actor.getSnapshot().context.visible?.id).toBe("second")
    clock.increment(MOVE_REACTION_DURATION_MS - 1)
    expect(actor.getSnapshot().context.visible?.id).toBe("second")
    clock.increment(1)
    expect(actor.getSnapshot().context.visible).toBeNull()
    actor.stop()
  })

  it("keeps one pending exceptional reaction ahead of newer routine feedback", () => {
    const { actor, clock, receive } = open()
    receive(reaction("visible"))
    receive(reaction("exceptional", "blunder"))
    receive(reaction("routine", "best"))
    expect(actor.getSnapshot().context.pending?.id).toBe("exceptional")
    receive(reaction("newer-exceptional", "genius"))
    expect(actor.getSnapshot().context.pending?.id).toBe("newer-exceptional")
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().context.visible?.id).toBe("newer-exceptional")
    actor.stop()
  })

  it("uses the newest equal-priority pending move without restarting visible time", () => {
    const { actor, clock, receive } = open()
    receive(reaction("visible"))
    clock.increment(4_000)
    receive(reaction("older"))
    receive(reaction("newer", "best"))
    clock.increment(1_000)
    expect(actor.getSnapshot().context.visible?.id).toBe("newer")
    actor.stop()
  })

  it("ignores duplicate delivery and stale dismissal identities", () => {
    const { actor, clock, receive } = open()
    receive(reaction("visible"))
    receive(reaction("visible"))
    receive(reaction("pending"))
    receive(reaction("pending"))
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "stale" })
    expect(actor.getSnapshot().context.visible?.id).toBe("visible")
    actor.send({ type: "MOVE_REACTION.DISMISSED", id: "visible" })
    expect(actor.getSnapshot().context.visible?.id).toBe("pending")
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().context.visible).toBeNull()
    actor.stop()
  })

  it("clears both reactions and cancels their old deadline", () => {
    const { actor, clock, receive } = open()
    receive(reaction("visible"))
    receive(reaction("pending"))
    clock.increment(4_000)
    actor.send({ type: "MOVE_REACTION.CLEARED" })
    expect(actor.getSnapshot().context).toEqual({
      visible: null,
      pending: null,
    })
    receive(reaction("fresh"))
    clock.increment(1_000)
    expect(actor.getSnapshot().context.visible?.id).toBe("fresh")
    clock.increment(4_000)
    expect(actor.getSnapshot().context.visible).toBeNull()
    actor.stop()
  })

  it("stopping the owner prevents queued feedback from being presented", () => {
    const { actor, clock, receive } = open()
    receive(reaction("visible"))
    receive(reaction("pending"))
    actor.stop()
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().status).toBe("stopped")
    expect(actor.getSnapshot().context.visible?.id).toBe("visible")
  })
})

import { describe, expect, it } from "vitest"
import { createActor, SimulatedClock } from "xstate"
import type { MatchColor } from "@mapachess/match/match-position"
import {
  MOVE_CLASSIFICATION_POLICY_ID,
  type MoveClassificationGrade,
} from "../src/moveClassification.js"
import moveReactionMachine, {
  MOVE_REACTION_DURATION_MS,
  selectMoveReactionColumns,
  type MoveReaction,
} from "../src/moveReactionMachine.js"

const reaction = (
  ply: number,
  mover: MatchColor = ply % 2 === 1 ? "white" : "black",
  grade: MoveClassificationGrade = "good",
): MoveReaction => ({
  id: `move/${String(ply)}`,
  ply,
  notation: `${String(Math.ceil(ply / 2))}${mover === "white" ? ". d4" : "... Nf6"}`,
  mover,
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
  const cards = () => actor.getSnapshot().context.cards
  const card = (ply: number) => {
    const entry = cards().find((item) => item.reaction.ply === ply)
    if (entry === undefined) throw new Error("Expected active reaction card")
    return entry
  }
  const present = (ply: number) =>
    card(ply).actor.send({ type: "MOVE_REACTION.PRESENTED" })
  const dismiss = (ply: number) =>
    actor.send({
      type: "MOVE_REACTION.DISMISSED",
      presentationId: card(ply).presentationId,
    })
  return { clock, actor, receive, cards, card, present, dismiss }
}

describe("independent move reaction cards", () => {
  it("presents both participants immediately and expires each five seconds after presentation", () => {
    const { actor, clock, receive, cards, present } = open()
    receive(reaction(1))
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(cards().map((card) => card.reaction.ply)).toEqual([1])
    present(1)
    clock.increment(1_000)
    receive(reaction(2, "black", "brilliant"))
    expect(cards().map((card) => card.reaction.ply)).toEqual([2, 1])
    present(2)
    present(1)
    clock.increment(3_999)
    expect(cards()).toHaveLength(2)
    clock.increment(1)
    expect(cards().map((card) => card.reaction.ply)).toEqual([2])
    clock.increment(999)
    expect(cards()).toHaveLength(1)
    clock.increment(1)
    expect(cards()).toEqual([])
    expect(Object.keys(actor.getSnapshot().children)).toEqual([])
    actor.stop()
  })

  it("orders late analysis by accepted ply and retains stable independent participant ownership", () => {
    const { actor, receive, card, dismiss } = open()
    receive(reaction(3, "white", "blunder"))
    const latestWhite = card(3)
    receive(reaction(4, "black", "brilliant"))
    receive(reaction(1))
    receive(reaction(2))
    const whiteHero = selectMoveReactionColumns(actor.getSnapshot(), "white")
    expect(whiteHero.hero.map((entry) => entry.reaction.ply)).toEqual([3, 1])
    expect(whiteHero.opponent.map((entry) => entry.reaction.ply)).toEqual([
      4, 2,
    ])
    const blackHero = selectMoveReactionColumns(actor.getSnapshot(), "black")
    expect(blackHero.hero).toEqual(whiteHero.opponent)
    expect(blackHero.opponent).toEqual(whiteHero.hero)
    dismiss(4)
    expect(
      selectMoveReactionColumns(actor.getSnapshot(), "white").hero,
    ).toEqual(whiteHero.hero)
    expect(card(3)).toBe(latestWhite)
    actor.stop()
  })

  it("dismisses only the activated card without replaying duplicate deliveries", () => {
    const { actor, clock, receive, cards, card, present, dismiss } = open()
    receive(reaction(1))
    receive(reaction(2))
    present(1)
    present(2)
    const dismissed = card(1)
    clock.increment(2_000)
    dismiss(1)
    expect(dismissed.actor.getSnapshot().status).toBe("stopped")
    receive(reaction(1))
    receive(reaction(2))
    actor.send({
      type: "MOVE_REACTION.DISMISSED",
      presentationId: dismissed.presentationId,
    })
    expect(cards().map((entry) => entry.reaction.ply)).toEqual([2])
    clock.increment(3_000)
    expect(cards()).toEqual([])
    receive(reaction(1))
    receive(reaction(2))
    expect(cards()).toEqual([])
    actor.stop()
  })

  it("clears every child deadline and rejects events from the previous presentation generation", () => {
    const { actor, clock, receive, cards, card, present } = open()
    receive(reaction(1))
    receive(reaction(2))
    present(1)
    present(2)
    const previous = [...cards()]
    clock.increment(4_000)
    actor.send({ type: "MOVE_REACTION.CLEARED" })
    expect(cards()).toEqual([])
    expect(Object.keys(actor.getSnapshot().children)).toEqual([])
    expect(
      previous.every((entry) => entry.actor.getSnapshot().status === "stopped"),
    ).toBe(true)
    receive(reaction(1))
    expect(card(1).presentationId).not.toBe(previous[0]?.presentationId)
    present(1)
    for (const old of previous) {
      actor.send({
        type: "MOVE_REACTION.EXPIRED",
        presentationId: old.presentationId,
      })
      actor.send({
        type: "MOVE_REACTION.DISMISSED",
        presentationId: old.presentationId,
      })
    }
    clock.increment(1_000)
    expect(cards()).toHaveLength(1)
    clock.increment(4_000)
    expect(cards()).toEqual([])
    actor.stop()
  })

  it("stops every active lifetime when its match-scoped owner stops", () => {
    const { actor, clock, receive, cards, present } = open()
    receive(reaction(1))
    receive(reaction(2))
    present(1)
    present(2)
    const active = [...cards()]
    actor.stop()
    clock.increment(MOVE_REACTION_DURATION_MS)
    expect(actor.getSnapshot().status).toBe("stopped")
    expect(
      active.every((entry) => entry.actor.getSnapshot().status === "stopped"),
    ).toBe(true)
  })

  it("does not hide or discard rapid arrivals behind a capacity limit", () => {
    const { actor, receive, cards } = open()
    for (let ply = 1; ply <= 100; ply += 1) receive(reaction(ply))
    expect(cards()).toHaveLength(100)
    expect(
      selectMoveReactionColumns(actor.getSnapshot(), "white").hero,
    ).toHaveLength(50)
    expect(
      selectMoveReactionColumns(actor.getSnapshot(), "white").opponent,
    ).toHaveLength(50)
    actor.send({ type: "MOVE_REACTION.CLEARED" })
    expect(Object.keys(actor.getSnapshot().children)).toEqual([])
    actor.stop()
  })
})

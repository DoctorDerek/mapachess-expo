import { describe, expect, it } from "vitest"
import { createActor, type ActorRefFrom } from "xstate"
import matchPresentationMachine, {
  selectMatchPresentationVariationOrdinal,
} from "../src/matchPresentationMachine.js"
import type { MatchPresentationPhase } from "../src/matchReaction.js"

const capture = {
  kind: "capture",
  player: { family: "capture", role: "attacker" },
  opponent: { family: "capture", role: "victim" },
} as const satisfies MatchPresentationPhase
const check = {
  kind: "check",
  player: { family: "check", role: "attacker" },
  opponent: { family: "check", role: "victim" },
} as const satisfies MatchPresentationPhase
const victory = {
  kind: "conclusion",
  player: { family: "victory" },
  opponent: { family: "defeat" },
} as const satisfies MatchPresentationPhase

type PresentationActor = ActorRefFrom<typeof matchPresentationMachine>
const start = (initialConclusionPhase: MatchPresentationPhase | null = null) =>
  createActor(matchPresentationMachine, {
    input: { initialConclusionPhase },
  }).start()
const request = (actor: PresentationActor, phase: MatchPresentationPhase) =>
  actor.send({
    type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
    phases: [phase],
  })
const ordinals = (actor: PresentationActor) =>
  (["player", "opponent"] as const).map((participant) =>
    selectMatchPresentationVariationOrdinal(actor.getSnapshot(), participant),
  )
const finishPhase = (actor: PresentationActor) => {
  for (let beat = 0; beat < 4; beat += 1) {
    const { context } = actor.getSnapshot()
    for (const participant of context.pendingParticipants) {
      actor.send({
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
        participant,
        phaseIndex: context.phaseIndex,
        reactionSequence: context.reactionSequence,
      })
    }
  }
}

describe("participant-scoped battle variation", () => {
  it("starts each role at zero and separates participants and unrelated reactions", () => {
    const actor = start()
    request(actor, capture)
    expect(ordinals(actor)).toEqual([0, 0])
    request(actor, capture)
    expect(ordinals(actor)).toEqual([1, 1])
    request(actor, check)
    expect(ordinals(actor)).toEqual([0, 0])
    request(actor, {
      kind: "capture",
      player: capture.opponent,
      opponent: capture.player,
    })
    expect(ordinals(actor)).toEqual([0, 0])
    request(actor, capture)
    expect(ordinals(actor)).toEqual([2, 2])
    request(actor, victory)
    expect(ordinals(actor)).toEqual([0, 0])
    request(actor, victory)
    expect(ordinals(actor)).toEqual([1, 1])
    actor.stop()
  })

  it("does not consume queued roles until their phase begins", () => {
    const actor = start()
    actor.send({
      type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
      phases: [capture, check, victory],
    })
    expect(actor.getSnapshot().context.variation.player["check-attacker"]).toBe(
      0,
    )
    finishPhase(actor)
    expect(actor.getSnapshot().context.currentPhase).toEqual(check)
    expect(ordinals(actor)).toEqual([0, 0])
    expect(actor.getSnapshot().context.variation.player.victory).toBe(0)
    finishPhase(actor)
    expect(actor.getSnapshot().matches("terminal")).toBe(true)
    expect(ordinals(actor)).toEqual([0, 0])
    expect(actor.getSnapshot().context.variation.player.victory).toBe(1)
    actor.stop()
  })

  it("preserves choices through completion and reset while rejecting stale callbacks", () => {
    const actor = start()
    request(actor, capture)
    const selected = actor.getSnapshot().context.variation
    finishPhase(actor)
    expect(actor.getSnapshot().matches("idle")).toBe(true)
    expect(actor.getSnapshot().context.variation).toBe(selected)
    expect(ordinals(actor)).toEqual([0, 0])
    actor.send({ type: "MATCH_PRESENTATION.RESET_REQUESTED" })
    expect(actor.getSnapshot().context.variation).toBe(selected)
    request(actor, capture)
    const beforeStaleCompletion = actor.getSnapshot()
    expect(ordinals(actor)).toEqual([1, 1])
    actor.send({
      type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
      participant: "player",
      phaseIndex: 0,
      reactionSequence: 1,
    })
    expect(actor.getSnapshot()).toBe(beforeStaleCompletion)
    actor.stop()
    const fresh = start()
    request(fresh, capture)
    expect(ordinals(fresh)).toEqual([0, 0])
    fresh.stop()
  })

  it("counts an initial conclusion once and leaves an idle participant untouched", () => {
    const actor = start(victory)
    expect(ordinals(actor)).toEqual([0, 0])
    request(actor, victory)
    expect(ordinals(actor)).toEqual([1, 1])
    request(actor, {
      kind: "conclusion",
      player: { family: "idle" },
      opponent: { family: "victory" },
    })
    expect(ordinals(actor)).toEqual([0, 0])
    expect(actor.getSnapshot().context.variation.player.victory).toBe(2)
    actor.stop()
  })
})

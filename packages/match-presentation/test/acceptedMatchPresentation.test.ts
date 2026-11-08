import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import matchMachine, {
  selectMatchConclusion,
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { reconstructMatchPosition } from "@mapachess/match/match-position"
import bindAcceptedMatchPresentation from "../src/acceptedMatchPresentation.js"
import matchPresentationMachine from "../src/matchPresentationMachine.js"

function match() {
  const parsed = reconstructMatchPosition(
    { variant: "standard", chess960PositionId: null },
    "3q3k/8/8/3p4/4P3/8/8/7K w - - 0 1",
  )
  if (!parsed.ok)
    throw new Error("The capture fixture must be a legal position.")
  return createActor(matchMachine, {
    input: {
      matchId: "presentation-fixture",
      playerColor: "white",
      autoHintMode: "no-auto-hints",
      durability: { type: "ephemeral" },
      initialPosition: parsed.position,
      opponent: {
        selectMove: async (request) => {
          const reply = request.legalMoves.find((move) => move.uci === "d8d5")
          if (reply === undefined)
            throw new Error("The reply must be a legal capture.")
          return reply.id
        },
      },
    },
  }).start()
}

describe("accepted match presentation ownership", () => {
  it("queues adjacent player/opponent captures even without an intermediate React render", async () => {
    const actor = match()
    const binding = bindAcceptedMatchPresentation(actor, "white")
    try {
      const move = listLegalMatchMoves(
        actor.getSnapshot().context.timeline.initialPosition,
      ).find((move) => move.uci === "e4d5")
      if (move === undefined)
        throw new Error("The player capture must be legal.")
      actor.send({ type: "MATCH.MOVE_REQUESTED", moveId: move.id })
      await waitFor(
        actor,
        (snapshot) => selectMatchTimeline(snapshot).cursor === 2,
      )
      expect(binding.actor.getSnapshot().context.currentPhase).toMatchObject({
        kind: "capture",
        player: { role: "attacker" },
      })
      expect(binding.actor.getSnapshot().context.remainingPhases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "capture",
            opponent: expect.objectContaining({ role: "attacker" }),
          }),
        ]),
      )
      actor.send({ type: "MATCH.UNDO_REQUESTED" })
      expect(binding.actor.getSnapshot().matches("idle")).toBe(true)
      expect(binding.actor.getSnapshot().context.remainingPhases).toEqual([])
    } finally {
      binding.close()
      actor.stop()
    }
  })
  it("replays a conclusion without changing accepted chess state and leaves a supplied actor owned by its caller", () => {
    const actor = match()
    const presentation = createActor(matchPresentationMachine, {
      input: { initialConclusionPhase: null },
    }).start()
    const binding = bindAcceptedMatchPresentation(actor, "white", presentation)
    actor.send({ type: "MATCH.RESIGN_REQUESTED" })
    const ending = selectMatchConclusion(actor.getSnapshot())
    const timeline = selectMatchTimeline(actor.getSnapshot())
    const sequence = presentation.getSnapshot().context.reactionSequence
    binding.replay()
    expect(presentation.getSnapshot().context.reactionSequence).toBeGreaterThan(
      sequence,
    )
    expect(selectMatchConclusion(actor.getSnapshot())).toBe(ending)
    expect(selectMatchTimeline(actor.getSnapshot())).toBe(timeline)
    binding.close()
    expect(presentation.getSnapshot().status).toBe("active")
    presentation.stop()
    actor.stop()
  })
})

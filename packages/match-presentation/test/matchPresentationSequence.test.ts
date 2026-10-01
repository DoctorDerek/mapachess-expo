import { describe, expect, it } from "vitest"
import { createActor } from "xstate"
import matchPresentationMachine, {
  selectMatchPresentationAnimalReaction,
  selectMatchPresentationBeat,
} from "../src/matchPresentationMachine"
import { deriveConclusionPresentationPhase } from "../src/matchPresentationObservation"
import type { MatchPresentationPhase } from "../src/matchReaction"

const capture = {
  kind: "capture",
  player: { family: "capture", role: "attacker" },
  opponent: { family: "capture", role: "victim" },
} as const satisfies MatchPresentationPhase
const reply = {
  kind: "capture",
  player: capture.opponent,
  opponent: capture.player,
} as const satisfies MatchPresentationPhase

describe("sequential animal performances", () => {
  it.each(["approach", "strike", "reaction", "recovery"] as const)(
    "appends a reply at %s without restarting the player",
    (beat) => {
      const actor = createActor(matchPresentationMachine, {
        input: { initialConclusionPhase: null },
      }).start()
      const completeBeat = () => {
        for (const participant of ["player", "opponent"] as const) {
          const { phaseIndex, reactionSequence } = actor.getSnapshot().context
          actor.send({
            type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
            participant,
            phaseIndex,
            reactionSequence,
          })
        }
      }
      actor.send({
        type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
        phases: [capture],
      })
      while (selectMatchPresentationBeat(actor.getSnapshot()) !== beat)
        completeBeat()
      const before = actor.getSnapshot().context
      const conclusion = deriveConclusionPresentationPhase({
        conclusion: { type: "checkmate", winner: "white" },
        playerColor: "white",
      })
      if (conclusion === null) throw new Error("Missing terminal fixture")
      actor.send({
        type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
        phases: [reply, conclusion],
      })
      const after = actor.getSnapshot().context
      expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe(beat)
      expect(after.currentPhase).toBe(before.currentPhase)
      expect(after.phaseIndex).toBe(before.phaseIndex)
      expect(after.reactionSequence).toBe(before.reactionSequence)
      expect(after.variation).toBe(before.variation)
      expect(after.pendingParticipants).toBe(before.pendingParticipants)
      while (actor.getSnapshot().context.currentPhase === capture)
        completeBeat()
      expect(actor.getSnapshot().context.currentPhase).toBe(reply)
      const replyStart = actor.getSnapshot().context
      actor.send({
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
        participant: "player",
        phaseIndex: before.phaseIndex,
        reactionSequence: before.reactionSequence,
      })
      expect(actor.getSnapshot().context.pendingParticipants).toBe(
        replyStart.pendingParticipants,
      )
      for (let index = 0; index < 4; index++) completeBeat()
      expect(actor.getSnapshot().matches("terminal")).toBe(true)
      expect(actor.getSnapshot().context.currentPhase).toBe(conclusion)
      actor.stop()
    },
  )

  it("preserves coach defeat on resignation without killing the animal", () => {
    const conclusion = deriveConclusionPresentationPhase({
      conclusion: { type: "resignation", winner: "black" },
      playerColor: "white",
    })
    const actor = createActor(matchPresentationMachine, {
      input: { initialConclusionPhase: conclusion },
    }).start()
    expect(actor.getSnapshot().context.currentPhase?.player.family).toBe(
      "defeat",
    )
    expect(
      selectMatchPresentationAnimalReaction(actor.getSnapshot(), "player"),
    ).toEqual({ family: "idle" })
    actor.stop()
  })
})

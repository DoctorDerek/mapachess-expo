import { describe, expect, it } from "vitest"
import { createActor } from "xstate"
import {
  applyMatchMove,
  parseMatchMoveId,
  type MatchMoveTransition,
} from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  type MatchPosition,
} from "@mapachess/match/match-position"
import resolveCoachPortrait from "../src/coachPortrait"
import matchPresentationMachine from "../src/matchPresentationMachine"
import deriveAcceptedMovePresentationPhases, {
  deriveConclusionPresentationPhase,
} from "../src/matchPresentationObservation"
import type {
  MatchPresentationParticipant,
  MatchPresentationPhase,
} from "../src/matchReaction"
import resolveSpritePresentation, {
  type SpriteAnimationDefinition,
  type SpriteAssetManifest,
  type SpritePlaybackMode,
  type SpriteReactionStep,
} from "../src/presentationAssetManifest"

const CAPTURE_PHASE = Object.freeze({
  kind: "capture",
  opponent: Object.freeze({ family: "capture", role: "victim" }),
  player: Object.freeze({ family: "capture", role: "attacker" }),
}) satisfies MatchPresentationPhase

const CHECK_PHASE = Object.freeze({
  kind: "check",
  opponent: Object.freeze({ family: "check", role: "victim" }),
  player: Object.freeze({ family: "check", role: "attacker" }),
}) satisfies MatchPresentationPhase

const PLAYER_VICTORY_PHASE = Object.freeze({
  kind: "conclusion",
  opponent: Object.freeze({ family: "defeat" }),
  player: Object.freeze({ family: "victory" }),
}) satisfies MatchPresentationPhase

const REACTION_SEQUENCE = Object.freeze([
  CAPTURE_PHASE,
  CHECK_PHASE,
  PLAYER_VICTORY_PHASE,
] as const)

const applyRequiredMove = (
  before: MatchPosition,
  uci: string,
): MatchMoveTransition => {
  const parsedMove = parseMatchMoveId(uci)
  if (!parsedMove.ok) throw new Error(`Invalid test move: ${uci}`)

  const result = applyMatchMove(before, parsedMove.moveId)
  if (!result.ok) throw new Error(`Illegal test move: ${uci}`)
  return result.transition
}

const playRequiredMoves = (moves: readonly string[]): MatchMoveTransition => {
  let position = createInitialMatchPosition({
    chess960PositionId: null,
    variant: "standard",
  })
  let latestTransition: MatchMoveTransition | null = null

  for (const move of moves) {
    latestTransition = applyRequiredMove(position, move)
    position = latestTransition.after
  }

  if (latestTransition === null) {
    throw new Error("A presentation test requires at least one accepted move.")
  }
  return latestTransition
}

const createPresentationActor = () =>
  createActor(matchPresentationMachine, {
    input: { initialConclusionPhase: null },
  }).start()

const completeParticipant = (
  actor: ReturnType<typeof createPresentationActor>,
  participant: MatchPresentationParticipant,
): void => {
  const { phaseIndex, reactionSequence } = actor.getSnapshot().context
  actor.send({
    participant,
    phaseIndex,
    reactionSequence,
    type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
  })
}

type TestAnimationId = "fallback" | "preferred"
type TestSourceId = "fallback-source" | "preferred-source"

const TEST_FRAME_GEOMETRY = Object.freeze({
  bottomCenterX: 8,
  bottomY: 16,
  frameHeight: 16,
  frameWidth: 16,
  visibleHeight: 16,
  visibleWidth: 16,
  visibleX: 0,
  visibleY: 0,
})

const testAnimation = (
  sourceId: TestSourceId,
): SpriteAnimationDefinition<TestSourceId> =>
  Object.freeze({
    frameCount: 1,
    frameDurationMilliseconds: 100,
    geometry: TEST_FRAME_GEOMETRY,
    reducedMotionFrameIndex: 0,
    sourceId,
  })

const orderedReactionStep = (
  playback: SpritePlaybackMode,
): SpriteReactionStep<TestAnimationId> =>
  Object.freeze({
    animationIds: Object.freeze(["preferred", "fallback"] as const),
    playback,
  })

const SPRITE_MANIFEST = Object.freeze({
  animations: Object.freeze({
    fallback: testAnimation("fallback-source"),
    preferred: testAnimation("preferred-source"),
  }),
  reactionPlans: Object.freeze({
    idle: Object.freeze([orderedReactionStep("loop")] as const),
    "capture-attacker": Object.freeze([orderedReactionStep("once")] as const),
    "capture-victim": Object.freeze([orderedReactionStep("once")] as const),
    "check-attacker": Object.freeze([orderedReactionStep("once")] as const),
    "check-victim": Object.freeze([orderedReactionStep("once")] as const),
    victory: Object.freeze([orderedReactionStep("loop")] as const),
    defeat: Object.freeze([
      orderedReactionStep("once-hold-final-frame"),
    ] as const),
  }),
}) satisfies SpriteAssetManifest<TestAnimationId, TestSourceId>

describe("match presentation contracts", () => {
  it("derives capture, check, and victory from one accepted checkmate move", () => {
    const checkmateTransition = playRequiredMoves([
      "e2e4",
      "e7e5",
      "f1c4",
      "b8c6",
      "d1h5",
      "g8f6",
      "h5f7",
    ])

    expect(
      deriveAcceptedMovePresentationPhases({
        conclusion: { type: "checkmate", winner: "white" },
        playerColor: "white",
        transition: checkmateTransition,
      }),
    ).toEqual(REACTION_SEQUENCE)
    expect(
      deriveConclusionPresentationPhase({
        conclusion: { type: "draw-agreement" },
        playerColor: "white",
      }),
    ).toBeNull()
  })

  it("waits for both participants and rejects stale completion identity", () => {
    const actor = createPresentationActor()
    actor.send({
      phases: REACTION_SEQUENCE,
      type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
    })

    const started = actor.getSnapshot()
    expect(started.matches("reacting")).toBe(true)
    expect(started.context.currentPhase).toEqual(CAPTURE_PHASE)
    expect(started.context.pendingParticipants).toEqual(["player", "opponent"])

    actor.send({
      participant: "player",
      phaseIndex: started.context.phaseIndex,
      reactionSequence: started.context.reactionSequence - 1,
      type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
    })
    expect(actor.getSnapshot().context.pendingParticipants).toEqual([
      "player",
      "opponent",
    ])

    completeParticipant(actor, "player")
    expect(actor.getSnapshot().context.pendingParticipants).toEqual([
      "opponent",
    ])
    completeParticipant(actor, "opponent")
    expect(actor.getSnapshot().context.currentPhase).toEqual(CHECK_PHASE)
    expect(actor.getSnapshot().context.phaseIndex).toBe(1)

    completeParticipant(actor, "opponent")
    completeParticipant(actor, "player")
    const completed = actor.getSnapshot()
    expect(completed.matches("terminal")).toBe(true)
    expect(completed.context.currentPhase).toEqual(PLAYER_VICTORY_PHASE)
    expect(completed.context.pendingParticipants).toEqual([])
    actor.stop()
  })

  it("uses ordered available assets before terminating in authored fallbacks", () => {
    expect(
      resolveSpritePresentation(
        SPRITE_MANIFEST,
        { family: "capture", role: "attacker" },
        ["fallback-source"],
      ),
    ).toMatchObject({
      kind: "sprite",
      steps: [{ animationId: "fallback" }],
    })
    expect(
      resolveSpritePresentation(SPRITE_MANIFEST, { family: "idle" }, []),
    ).toEqual({ kind: "authored-fallback", reactionSlot: "idle" })
    expect(resolveCoachPortrait({ family: "victory" }, ["neutral"])).toEqual({
      kind: "portrait",
      label: "neutral",
    })
    expect(resolveCoachPortrait({ family: "defeat" }, [])).toEqual({
      kind: "authored-fallback",
      label: "neutral",
    })
  })
})

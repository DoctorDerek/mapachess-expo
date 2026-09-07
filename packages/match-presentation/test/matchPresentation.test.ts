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
import matchPresentationMachine, {
  selectMatchPresentationBeat,
  type MatchPresentationBeat,
} from "../src/matchPresentationMachine"
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

type TestAnimationId = "fallback" | "idle" | "preferred"
type TestSourceId = "fallback-source" | "idle-source" | "preferred-source"

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
  beat: MatchPresentationBeat,
): SpriteReactionStep<TestAnimationId> =>
  Object.freeze({
    animationIds: Object.freeze(["preferred", "fallback"] as const),
    beat,
    playback,
  })

const SPRITE_MANIFEST = Object.freeze({
  referenceGeometry: TEST_FRAME_GEOMETRY,
  sourceFacing: "right",
  animations: Object.freeze({
    fallback: testAnimation("fallback-source"),
    idle: testAnimation("idle-source"),
    preferred: testAnimation("preferred-source"),
  }),
  reactionPlans: Object.freeze({
    idle: Object.freeze([
      { animationIds: ["idle"], beat: "idle", playback: "loop" },
    ] as const),
    "capture-attacker": Object.freeze([
      orderedReactionStep("once", "strike"),
    ] as const),
    "capture-victim": Object.freeze([
      orderedReactionStep("once", "reaction"),
    ] as const),
    "check-attacker": Object.freeze([
      orderedReactionStep("once", "strike"),
    ] as const),
    "check-victim": Object.freeze([
      orderedReactionStep("once", "reaction"),
    ] as const),
    victory: Object.freeze([
      orderedReactionStep("loop", "conclusion"),
    ] as const),
    defeat: Object.freeze([
      orderedReactionStep("once-hold-final-frame", "conclusion"),
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
    expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe("strike")
    for (const beat of ["strike", "reaction", "recovery"]) {
      expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe(beat)
      completeParticipant(actor, "opponent")
      completeParticipant(actor, "player")
    }
    expect(actor.getSnapshot().context.currentPhase).toEqual(CHECK_PHASE)
    expect(actor.getSnapshot().context.phaseIndex).toBe(4)

    for (const beat of ["approach", "strike", "reaction", "recovery"]) {
      expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe(beat)
      completeParticipant(actor, "opponent")
      completeParticipant(actor, "player")
    }
    const completed = actor.getSnapshot()
    expect(completed.matches("terminal")).toBe(true)
    expect(completed.context.currentPhase).toEqual(PLAYER_VICTORY_PHASE)
    expect(completed.context.pendingParticipants).toEqual([])
    actor.stop()
  })

  it.each([0, 1, 2, 3])(
    "rejects old completions after interruption at beat %s",
    (beatIndex) => {
      const actor = createPresentationActor()
      actor.send({
        phases: [CAPTURE_PHASE],
        type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
      })
      for (let index = 0; index < beatIndex; index += 1) {
        completeParticipant(actor, "player")
        completeParticipant(actor, "opponent")
      }
      const previous = actor.getSnapshot().context
      actor.send({
        phases: [CHECK_PHASE],
        type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
      })
      expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe("approach")
      actor.send({
        participant: "player",
        phaseIndex: previous.phaseIndex,
        reactionSequence: previous.reactionSequence,
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
      })
      expect(actor.getSnapshot().context.pendingParticipants).toEqual([
        "player",
        "opponent",
      ])
      actor.send({ type: "MATCH_PRESENTATION.RESET_REQUESTED" })
      completeParticipant(actor, "player")
      expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe("idle")
      expect(actor.getSnapshot().context.currentPhase).toBeNull()
      actor.stop()
    },
  )

  it("returns to idle after the final recovery without a match conclusion", () => {
    const actor = createPresentationActor()
    actor.send({
      phases: [CAPTURE_PHASE],
      type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
    })
    for (let index = 0; index < 4; index += 1) {
      completeParticipant(actor, "player")
      completeParticipant(actor, "opponent")
    }
    expect(selectMatchPresentationBeat(actor.getSnapshot())).toBe("idle")
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

  it("keeps an available strike after a missing locomotion step uses idle", () => {
    const manifest = {
      ...SPRITE_MANIFEST,
      reactionPlans: {
        ...SPRITE_MANIFEST.reactionPlans,
        "capture-attacker": [
          { animationIds: ["preferred"], beat: "approach", playback: "once" },
          { animationIds: ["fallback"], beat: "strike", playback: "once" },
        ],
      },
    } as const satisfies SpriteAssetManifest<TestAnimationId, TestSourceId>

    expect(
      resolveSpritePresentation(
        manifest,
        { family: "capture", role: "attacker" },
        ["idle-source", "fallback-source"],
      ),
    ).toMatchObject({
      kind: "sprite",
      reactionSlot: "capture-attacker",
      referenceGeometry: TEST_FRAME_GEOMETRY,
      sourceFacing: "right",
      steps: [
        { animationId: "idle", beat: "approach", playback: "once" },
        { animationId: "fallback", beat: "strike", playback: "once" },
      ],
    })
  })

  it("uses valid idle for a missing terminal clip without replacing available death playback", () => {
    expect(
      resolveSpritePresentation(SPRITE_MANIFEST, { family: "defeat" }, [
        "idle-source",
      ]),
    ).toMatchObject({
      kind: "sprite",
      reactionSlot: "defeat",
      steps: [{ animationId: "idle", playback: "once-hold-final-frame" }],
    })
    expect(
      resolveSpritePresentation(SPRITE_MANIFEST, { family: "defeat" }, [
        "preferred-source",
        "idle-source",
      ]),
    ).toMatchObject({
      steps: [{ animationId: "preferred", playback: "once-hold-final-frame" }],
    })
  })

  it("uses a complete idle fallback instead of an incomplete celebration chain", () => {
    const manifest = {
      ...SPRITE_MANIFEST,
      reactionPlans: {
        ...SPRITE_MANIFEST.reactionPlans,
        victory: [
          { animationIds: ["preferred"], beat: "conclusion", playback: "once" },
          { animationIds: ["fallback"], beat: "conclusion", playback: "loop" },
        ],
      },
    } as const satisfies SpriteAssetManifest<TestAnimationId, TestSourceId>
    expect(
      resolveSpritePresentation(manifest, { family: "victory" }, [
        "idle-source",
        "fallback-source",
      ]),
    ).toMatchObject({
      steps: [{ animationId: "idle", beat: "conclusion", playback: "loop" }],
    })
  })
})

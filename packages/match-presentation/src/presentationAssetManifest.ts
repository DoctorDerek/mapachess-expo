import type { MatchPresentationBeat } from "./matchPresentationMachine.js"
import type { MatchParticipantReaction } from "./matchReaction.js"

export const PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS = 100
export const CALM_ANIMAL_FRAME_DURATION_MILLISECONDS = 160
export const STANDALONE_ANIMAL_SCALE = 3

export type SpriteClearance = Readonly<{
  above: number
  below: number
  horizontalRadius: number
}>

export type SpriteLayout = Readonly<{
  referenceGeometry: SpriteFrameGeometry
  clearance: SpriteClearance
  standaloneScale?: number
}>

export const MATCH_SPRITE_REACTION_SLOTS = [
  "idle",
  "capture-attacker",
  "capture-victim",
  "check-attacker",
  "check-victim",
  "victory",
  "defeat",
] as const

export type MatchSpriteReactionSlot =
  (typeof MATCH_SPRITE_REACTION_SLOTS)[number]

export type SpritePlaybackMode = "loop" | "once" | "once-hold-final-frame"

export type SpriteFacing = "left" | "right"

export type SpriteFrameGeometry = Readonly<{
  bottomCenterX: number
  bottomY: number
  frameHeight: number
  frameWidth: number
  visibleHeight: number
  visibleWidth: number
  visibleX: number
  visibleY: number
}>

export type SpriteAnimationDefinition<SourceId extends string> = Readonly<{
  frameCount: number
  frameDurationMilliseconds: number
  geometry: SpriteFrameGeometry
  reducedMotionFrameIndex: number
  sourceId: SourceId
}>

export type SpriteReactionStep<AnimationId extends string> = Readonly<{
  animationIds: readonly [AnimationId, ...AnimationId[]]
  beat: MatchPresentationBeat
  playback: SpritePlaybackMode
}>

export type SpriteReactionPlan<AnimationId extends string> = readonly [
  SpriteReactionStep<AnimationId>,
  ...SpriteReactionStep<AnimationId>[],
]

export type SpriteAssetManifest<
  AnimationId extends string,
  SourceId extends string,
> = Readonly<{
  animations: Readonly<Record<AnimationId, SpriteAnimationDefinition<SourceId>>>
  calmFrameDurationMilliseconds?: number
  attentionAnimationId?: AnimationId
  referenceGeometry: SpriteFrameGeometry
  standaloneScale?: number
  sourceFacing: SpriteFacing
  reactionAlternatives?: Readonly<
    Partial<
      Record<
        MatchSpriteReactionSlot,
        readonly SpriteReactionPlan<AnimationId>[]
      >
    >
  >
  reactionPlans: Readonly<
    Record<MatchSpriteReactionSlot, SpriteReactionPlan<AnimationId>>
  >
}>

export type ResolvedSpriteStep<
  AnimationId extends string,
  SourceId extends string,
> = Readonly<{
  animation: SpriteAnimationDefinition<SourceId>
  animationId: AnimationId
  beat: MatchPresentationBeat
  playback: SpritePlaybackMode
}>

export type ResolvedSpritePresentation<
  AnimationId extends string,
  SourceId extends string,
> = Readonly<{ layout: SpriteLayout }> &
  (
    | Readonly<{
        kind: "sprite"
        reactionSlot: MatchSpriteReactionSlot
        referenceGeometry: SpriteFrameGeometry
        sourceFacing: SpriteFacing
        steps: readonly [
          ResolvedSpriteStep<AnimationId, SourceId>,
          ...ResolvedSpriteStep<AnimationId, SourceId>[],
        ]
      }>
    | Readonly<{
        kind: "authored-fallback"
        reactionSlot: MatchSpriteReactionSlot
      }>
  )

export const matchSpriteReactionSlot = (
  reaction: MatchParticipantReaction,
): MatchSpriteReactionSlot => {
  switch (reaction.family) {
    case "idle":
    case "victory":
    case "defeat":
      return reaction.family
    case "capture":
    case "check":
      return `${reaction.family}-${reaction.role}`
  }
}

const resolveStep = <AnimationId extends string, SourceId extends string>(
  manifest: SpriteAssetManifest<AnimationId, SourceId>,
  step: SpriteReactionStep<AnimationId>,
  availableSourceIds: readonly SourceId[],
  frameDurationMilliseconds?: number,
): ResolvedSpriteStep<AnimationId, SourceId> | null => {
  const animationId = step.animationIds.find((candidateId) =>
    availableSourceIds.includes(manifest.animations[candidateId].sourceId),
  )
  return animationId === undefined
    ? null
    : Object.freeze({
        animation:
          frameDurationMilliseconds === undefined
            ? manifest.animations[animationId]
            : Object.freeze({
                ...manifest.animations[animationId],
                frameDurationMilliseconds,
              }),
        animationId,
        beat: step.beat,
        playback: step.playback,
      })
}

export const resolveSpriteAttention = <
  AnimationId extends string,
  SourceId extends string,
>(
  manifest: SpriteAssetManifest<AnimationId, SourceId>,
  availableSourceIds: readonly SourceId[],
): ResolvedSpriteStep<AnimationId, SourceId> | null =>
  manifest.attentionAnimationId === undefined
    ? null
    : resolveStep(
        manifest,
        {
          animationIds: [manifest.attentionAnimationId],
          beat: "idle",
          playback: "once",
        },
        availableSourceIds,
        PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS,
      )

export default function resolveSpritePresentation<
  AnimationId extends string,
  SourceId extends string,
>(
  manifest: SpriteAssetManifest<AnimationId, SourceId>,
  reaction: MatchParticipantReaction,
  availableSourceIds: readonly SourceId[],
  reactionSequence = 0,
): ResolvedSpritePresentation<AnimationId, SourceId> {
  const reactionSlot = matchSpriteReactionSlot(reaction)
  const eligibleGeometry = [
    ...Object.values(manifest.reactionPlans),
    ...Object.values(manifest.reactionAlternatives ?? {}).flat(),
  ].flatMap((steps) =>
    steps.flatMap(({ animationIds }) =>
      animationIds.map((id) => manifest.animations[id].geometry),
    ),
  )
  const layout: SpriteLayout = Object.freeze({
    referenceGeometry: manifest.referenceGeometry,
    ...(manifest.standaloneScale === undefined
      ? {}
      : { standaloneScale: manifest.standaloneScale }),
    clearance: Object.freeze({
      above: Math.max(
        0,
        ...eligibleGeometry.map((g) => g.bottomY - g.visibleY),
      ),
      below: Math.max(
        0,
        ...eligibleGeometry.map(
          (g) => g.visibleY + g.visibleHeight - g.bottomY,
        ),
      ),
      horizontalRadius: Math.max(
        0,
        ...eligibleGeometry.flatMap((g) => [
          g.bottomCenterX - g.visibleX,
          g.visibleX + g.visibleWidth - g.bottomCenterX,
        ]),
      ),
    }),
  })
  const idleStep = manifest.reactionPlans.idle
    .map((step) =>
      resolveStep(
        manifest,
        step,
        availableSourceIds,
        manifest.calmFrameDurationMilliseconds,
      ),
    )
    .find((step) => step !== null)
  const idleFallback =
    idleStep === undefined
      ? null
      : Object.freeze({ ...idleStep, playback: "loop" as const })
  const candidates = [
    manifest.reactionPlans[reactionSlot],
    ...(manifest.reactionAlternatives?.[reactionSlot] ?? []),
  ]
  const selectedIndex = reactionSequence % candidates.length
  const selectedPlan =
    [
      ...candidates.slice(selectedIndex),
      ...candidates.slice(0, selectedIndex),
    ].find((candidate) =>
      candidate.every((step) =>
        step.animationIds.some((id) =>
          availableSourceIds.includes(manifest.animations[id].sourceId),
        ),
      ),
    ) ?? manifest.reactionPlans[reactionSlot]
  const plan = selectedPlan.map((step) => ({
    step,
    resolved: resolveStep(
      manifest,
      step,
      availableSourceIds,
      reactionSlot === "idle"
        ? manifest.calmFrameDurationMilliseconds
        : undefined,
    ),
  }))
  const completeSequenceAvailable = plan.every(
    ({ resolved }) => resolved !== null,
  )
  const resolvedSteps = !completeSequenceAvailable
    ? idleFallback === null
      ? []
      : [
          Object.freeze({
            ...idleFallback,
            beat:
              reaction.family === "victory" || reaction.family === "defeat"
                ? ("conclusion" as const)
                : ("idle" as const),
            playback:
              reaction.family === "defeat"
                ? ("once-hold-final-frame" as const)
                : ("loop" as const),
          }),
        ]
    : plan.flatMap(({ resolved }) => (resolved === null ? [] : [resolved]))
  const [firstStep, ...remainingSteps] = resolvedSteps

  return firstStep === undefined
    ? Object.freeze({ kind: "authored-fallback", reactionSlot, layout })
    : Object.freeze({
        kind: "sprite",
        layout,
        reactionSlot,
        referenceGeometry: manifest.referenceGeometry,
        sourceFacing: manifest.sourceFacing,
        steps: Object.freeze([firstStep, ...remainingSteps] as const),
      })
}

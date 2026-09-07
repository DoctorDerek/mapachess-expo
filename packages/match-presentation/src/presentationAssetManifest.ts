import type { MatchPresentationBeat } from "./matchPresentationMachine.js"
import type { MatchParticipantReaction } from "./matchReaction.js"

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

export type SpriteAssetManifest<
  AnimationId extends string,
  SourceId extends string,
> = Readonly<{
  animations: Readonly<Record<AnimationId, SpriteAnimationDefinition<SourceId>>>
  referenceGeometry: SpriteFrameGeometry
  sourceFacing: SpriteFacing
  reactionPlans: Readonly<
    Record<
      MatchSpriteReactionSlot,
      readonly [
        SpriteReactionStep<AnimationId>,
        ...SpriteReactionStep<AnimationId>[],
      ]
    >
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
> =
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
): ResolvedSpriteStep<AnimationId, SourceId> | null => {
  const animationId = step.animationIds.find((candidateId) =>
    availableSourceIds.includes(manifest.animations[candidateId].sourceId),
  )
  return animationId === undefined
    ? null
    : Object.freeze({
        animation: manifest.animations[animationId],
        animationId,
        beat: step.beat,
        playback: step.playback,
      })
}

export default function resolveSpritePresentation<
  AnimationId extends string,
  SourceId extends string,
>(
  manifest: SpriteAssetManifest<AnimationId, SourceId>,
  reaction: MatchParticipantReaction,
  availableSourceIds: readonly SourceId[],
): ResolvedSpritePresentation<AnimationId, SourceId> {
  const reactionSlot = matchSpriteReactionSlot(reaction)
  const idleStep = manifest.reactionPlans.idle
    .map((step) => resolveStep(manifest, step, availableSourceIds))
    .find((step) => step !== null)
  const idleFallback =
    idleStep === undefined
      ? null
      : Object.freeze({ ...idleStep, playback: "loop" as const })
  const plan = manifest.reactionPlans[reactionSlot].map((step) => ({
    step,
    resolved: resolveStep(manifest, step, availableSourceIds),
  }))
  const completeSequenceAvailable = plan.every(
    ({ resolved }) => resolved !== null,
  )
  const resolvedSteps =
    reaction.family === "victory" && !completeSequenceAvailable
      ? idleFallback === null
        ? []
        : [Object.freeze({ ...idleFallback, beat: "conclusion" as const })]
      : plan.flatMap(({ step, resolved }) => {
          const resolvedStep =
            resolved ??
            (idleFallback === null
              ? null
              : Object.freeze({
                  ...idleFallback,
                  beat: step.beat,
                  playback: step.playback,
                }))
          return resolvedStep === null ? [] : [resolvedStep]
        })
  const [firstStep, ...remainingSteps] = resolvedSteps

  return firstStep === undefined
    ? Object.freeze({ kind: "authored-fallback", reactionSlot })
    : Object.freeze({
        kind: "sprite",
        reactionSlot,
        referenceGeometry: manifest.referenceGeometry,
        sourceFacing: manifest.sourceFacing,
        steps: Object.freeze([firstStep, ...remainingSteps] as const),
      })
}

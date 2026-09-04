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
  playback: SpritePlaybackMode
}>

export type SpriteAssetManifest<
  AnimationId extends string,
  SourceId extends string,
> = Readonly<{
  animations: Readonly<Record<AnimationId, SpriteAnimationDefinition<SourceId>>>
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
  playback: SpritePlaybackMode
}>

export type ResolvedSpritePresentation<
  AnimationId extends string,
  SourceId extends string,
> =
  | Readonly<{
      kind: "sprite"
      reactionSlot: MatchSpriteReactionSlot
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
  const resolvedSteps = manifest.reactionPlans[reactionSlot].flatMap((step) => {
    const resolvedStep = resolveStep(manifest, step, availableSourceIds)
    return resolvedStep === null ? [] : [resolvedStep]
  })
  const [firstStep, ...remainingSteps] = resolvedSteps

  return firstStep === undefined
    ? Object.freeze({ kind: "authored-fallback", reactionSlot })
    : Object.freeze({
        kind: "sprite",
        reactionSlot,
        steps: Object.freeze([firstStep, ...remainingSteps] as const),
      })
}

import type { SpriteReactionPlan } from "./presentationAssetManifest.js"

export default function createCelebrationRecipe<AnimationId extends string>(
  first: AnimationId,
  ...remaining: AnimationId[]
): SpriteReactionPlan<AnimationId> {
  return [
    { animationIds: [first], beat: "conclusion", playback: "once" },
    ...remaining.map((animationId) => ({
      animationIds: [animationId] as const,
      beat: "conclusion" as const,
      playback: "once" as const,
    })),
  ]
}

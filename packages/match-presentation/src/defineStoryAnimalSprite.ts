import {
  PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS,
  type SpriteAnimationDefinition,
  type SpriteAssetManifest,
  type SpriteFrameGeometry,
} from "./presentationAssetManifest.js"

type SpriteClip = readonly [
  frameCount: number,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  overrides?: Readonly<{ sourceFileName?: string; bottomY?: number }>,
]

type StoryAnimalSpriteSource<AnimationId extends string> = Readonly<{
  sourceAnimalId: string
  relativeDirectory: string
  filePrefix: string
  frameSize: number
  clips: Readonly<Record<AnimationId, SpriteClip>>
}> &
  (
    | Readonly<{ referenceAnimation: NoInfer<AnimationId> }>
    | Readonly<{ clips: Readonly<Record<"idle", SpriteClip>> }>
  )

export default function defineStoryAnimalSprite<AnimationId extends string>(
  source: StoryAnimalSpriteSource<AnimationId>,
  reactionPlans: SpriteAssetManifest<
    NoInfer<AnimationId>,
    string
  >["reactionPlans"],
): SpriteAssetManifest<string, string> {
  const [, visibleX, visibleY, visibleWidth, visibleHeight] =
    "referenceAnimation" in source
      ? source.clips[source.referenceAnimation]
      : source.clips.idle
  const referenceGeometry: SpriteFrameGeometry = Object.freeze({
    bottomCenterX: visibleX + visibleWidth / 2,
    bottomY: visibleY + visibleHeight,
    frameWidth: source.frameSize,
    frameHeight: source.frameSize,
    visibleX,
    visibleY,
    visibleWidth,
    visibleHeight,
  })
  const animations = Object.fromEntries(
    Object.entries<SpriteClip>(source.clips).map(
      ([animationId, [frameCount, x, y, width, height, overrides]]) => {
        const animation: SpriteAnimationDefinition<string> = Object.freeze({
          frameCount,
          frameDurationMilliseconds: PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS,
          geometry: Object.freeze({
            ...referenceGeometry,
            bottomY: overrides?.bottomY ?? referenceGeometry.bottomY,
            visibleX: x,
            visibleY: y,
            visibleWidth: width,
            visibleHeight: height,
          }),
          reducedMotionFrameIndex:
            animationId === "die"
              ? frameCount - 1
              : animationId.startsWith("idle")
                ? 0
                : Math.floor(frameCount / 2),
          sourceId: `${source.relativeDirectory}/${overrides?.sourceFileName ?? `${source.filePrefix}_${animationId}_strip${frameCount}.png`}`,
        })
        return [animationId, animation]
      },
    ),
  )
  return Object.freeze({
    animations: Object.freeze(animations),
    referenceGeometry,
    sourceFacing: "right",
    reactionPlans,
  })
}

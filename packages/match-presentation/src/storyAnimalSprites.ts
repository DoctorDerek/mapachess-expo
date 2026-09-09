import {
  PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS,
  type SpriteAnimationDefinition,
  type SpriteAssetManifest,
  type SpriteFrameGeometry,
} from "./presentationAssetManifest.js"
import STORY_ANIMAL_SPRITE_DATA from "./storyAnimalSpriteData.js"

type SpriteClip = readonly [
  frameCount: number,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
]

type StoryAnimalSpriteSource<AnimationId extends string> = Readonly<{
  sourceAnimalId: string
  relativeDirectory: string
  filePrefix: string
  frameSize: number
  clips: Readonly<Record<AnimationId | "idle", SpriteClip>>
}>

function defineStoryAnimalSprite<AnimationId extends string>(
  source: StoryAnimalSpriteSource<AnimationId>,
  reactionPlans: SpriteAssetManifest<
    NoInfer<AnimationId> | "idle",
    string
  >["reactionPlans"],
): SpriteAssetManifest<string, string> {
  const [, visibleX, visibleY, visibleWidth, visibleHeight] = source.clips.idle
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
      ([animationId, [frameCount, x, y, width, height]]) => {
        const animation: SpriteAnimationDefinition<string> = Object.freeze({
          frameCount,
          frameDurationMilliseconds: PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS,
          geometry: Object.freeze({
            ...referenceGeometry,
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
          sourceId: `${source.relativeDirectory}/${source.filePrefix}_${animationId}_strip${frameCount}.png`,
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

const STORY_ANIMAL_SPRITES = Object.freeze({
  "bunny-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.bunny, {
    idle: [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["run"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["run"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["fright"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["idle_blink"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "dog-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.dog, {
    idle: [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["bark"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["fright"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["bark"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "cat-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.cat, {
    idle: [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["fright"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["idle_blink"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "mouse-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.mouse, {
    idle: [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["run"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["run"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["sniff"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "frog-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.frog, {
    idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["hop"], beat: "approach", playback: "once" },
      { animationIds: ["attackforward"], beat: "strike", playback: "once" },
      { animationIds: ["hop"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["hop"], beat: "approach", playback: "once" },
      { animationIds: ["croak"], beat: "strike", playback: "once" },
      { animationIds: ["hop"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["fright"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["croak"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "turtle-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.turtle, {
    idle: [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["walk"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["walk"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["hide"], beat: "reaction", playback: "once" },
      { animationIds: ["unhide"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["idle_blink"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "panda-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.panda, {
    idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack01"], beat: "strike", playback: "once" },
      { animationIds: ["run"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack02"], beat: "strike", playback: "once" },
      { animationIds: ["run"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["fright"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["idle_laugh"], beat: "conclusion", playback: "loop" },
    ],
  }),
  "otter-stockfish": defineStoryAnimalSprite(STORY_ANIMAL_SPRITE_DATA.otter, {
    idle: [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
    "capture-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "capture-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    "check-attacker": [
      { animationIds: ["run"], beat: "approach", playback: "once" },
      { animationIds: ["attack"], beat: "strike", playback: "once" },
      { animationIds: ["walk"], beat: "recovery", playback: "once" },
    ],
    "check-victim": [
      { animationIds: ["hurt"], beat: "reaction", playback: "once" },
    ],
    defeat: [
      {
        animationIds: ["die"],
        beat: "conclusion",
        playback: "once-hold-final-frame",
      },
    ],
    victory: [
      { animationIds: ["jump"], beat: "conclusion", playback: "once" },
      { animationIds: ["fall"], beat: "conclusion", playback: "once" },
      { animationIds: ["land"], beat: "conclusion", playback: "once" },
      { animationIds: ["idle_blink"], beat: "conclusion", playback: "loop" },
    ],
  }),
})

export default STORY_ANIMAL_SPRITES

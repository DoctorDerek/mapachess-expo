import createCelebrationRecipe from "./createCelebrationRecipe.js"
import defineStoryAnimalSprite from "./defineStoryAnimalSprite.js"
import type { SpriteReactionPlan } from "./presentationAssetManifest.js"

const source = {
  sourceAnimalId: "bearpack",
  relativeDirectory: "battle/bear",
  filePrefix: "bear",
  frameSize: 64,
  attentionAnimationIds: ["roar"],
  clips: {
    bite: [8, 5, 20, 55, 33],
    die: [12, 8, 17, 50, 36],
    fall: [1, 14, 19, 46, 34],
    fright: [10, 5, 20, 52, 33],
    hurt: [7, 9, 17, 48, 36],
    idle_blink: [6, 9, 19, 48, 34],
    idle: [6, 9, 19, 48, 34],
    jump: [12, 9, 18, 50, 35],
    land: [3, 9, 21, 48, 32],
    roar: [14, 5, 20, 55, 33],
    run: [8, 2, 17, 58, 36],
    sleep: [6, 9, 33, 48, 20],
    stand_attack01: [7, 0, 4, 55, 49],
    stand_attack02: [7, 7, 4, 48, 49],
    stand_go_down: [5, 9, 3, 49, 50],
    stand_go_up: [5, 9, 3, 49, 50],
    stand_idle_blink: [6, 9, 3, 35, 50],
    stand_idle: [6, 9, 3, 35, 50],
    stand_roar: [14, 7, 5, 39, 48],
    wakeup: [14, 9, 20, 48, 33],
  },
} as const

type BearClip = keyof typeof source.clips
const BITE_CONTACT_ADVANCE = {
  chickenpack: 1,
  bunnypack: 4,
  dogpack: -4,
  "catset/cat03_orange": 6,
  "mousepack/mouse03_light_gray": 14,
  squirrelpack: 13,
  frogpack: 9,
  turtle: 9,
  pandapack: -4,
  lilotter: 12,
  raccoon: -1,
  lilaxolotl: 11,
  parrot: 5,
  lilhedgehog: 12,
  deer_female: -1,
  fox: -2,
  wolf: -4,
  tigerpack: -4,
  bearpack: 0,
  falcon: 2,
  redcrane: -1,
  crow: 5,
  bat: 8,
  lilmaskedninja: 4,
  lilwarhero_knife: 3,
  dragonfly01: 12,
} as const
const SWIPE_CONTACT_ADVANCE = {
  chickenpack: 3,
  bunnypack: 7,
  dogpack: 1,
  "catset/cat03_orange": 4,
  frogpack: 5,
  turtle: 8,
  pandapack: 1,
  raccoon: 3,
  parrot: 7,
  deer_female: 3,
  fox: 2,
  wolf: 1,
  tigerpack: 1,
  bearpack: 5,
  falcon: 6,
  redcrane: 3,
  crow: 7,
  bat: 7,
  lilmaskedninja: 6,
  lilwarhero_knife: 4,
  dragonfly01: 12,
} as const
const SWIPE_WINDUP_ADVANCE = {
  pandapack: -1,
  deer_female: -2,
  tigerpack: -1,
  bearpack: -2,
  redcrane: -2,
} as const
const upright = (
  clip: BearClip,
  beat: "idle" | "strike" | "conclusion",
): SpriteReactionPlan<BearClip> => [
  { animationIds: ["stand_go_up"], beat, playback: "once" },
  { animationIds: [clip], beat, playback: "once" },
  { animationIds: ["stand_go_down"], beat, playback: "once" },
]
const calmEnding = {
  animationIds: ["idle"],
  beat: "conclusion",
  playback: "once",
  pacing: "calm",
} as const
const capture = (
  clip: "bite" | "stand_attack01" | "stand_attack02",
): SpriteReactionPlan<BearClip> => [
  { animationIds: ["run"], beat: "approach", playback: "once" },
  ...(clip === "bite"
    ? []
    : [
        {
          animationIds: ["stand_go_up"],
          beat: "strike",
          playback: "once",
        } as const,
      ]),
  {
    animationIds: [clip],
    beat: "strike",
    playback: "once",
    frames: [0, 4],
    contactAdvanceByTarget:
      clip === "bite" ? BITE_CONTACT_ADVANCE : SWIPE_CONTACT_ADVANCE,
    ...(clip === "bite"
      ? {}
      : {
          windupAdvanceByTarget: SWIPE_WINDUP_ADVANCE,
          excludedTargetSourceIds: [
            "mousepack/mouse03_light_gray",
            "squirrelpack",
            "lilotter",
            "lilaxolotl",
            "lilhedgehog",
          ],
        }),
  },
  {
    animationIds: [clip],
    beat: "reaction",
    playback: "once",
    frames: [4, source.clips[clip][0]],
  },
  ...(clip === "bite"
    ? []
    : [
        {
          animationIds: ["stand_go_down"],
          beat: "reaction",
          playback: "once",
        } as const,
      ]),
  { animationIds: ["run"], beat: "recovery", playback: "once" },
]

const BEAR_SPRITE = Object.freeze({
  ...defineStoryAnimalSprite(
    source,
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
      "capture-attacker": capture("bite"),
      "capture-victim": [
        { animationIds: ["hurt"], beat: "reaction", playback: "once" },
      ],
      "check-attacker": [
        { animationIds: ["roar"], beat: "strike", playback: "once" },
      ],
      "check-victim": [
        { animationIds: ["fright"], beat: "reaction", playback: "once" },
      ],
      victory: [...createCelebrationRecipe("roar"), calmEnding],
      defeat: [
        {
          animationIds: ["die"],
          beat: "conclusion",
          playback: "once-hold-final-frame",
        },
      ],
    },
    {
      idle: [
        [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
      ],
      "capture-attacker": [
        capture("stand_attack01"),
        capture("stand_attack02"),
      ],
      "check-attacker": [upright("stand_roar", "strike")],
      victory: [
        [...createCelebrationRecipe("jump", "fall", "land"), calmEnding],
        [...upright("stand_roar", "conclusion"), calmEnding],
      ],
    },
  ),
  attentionPlans: [
    upright("stand_idle_blink", "idle"),
    [{ animationIds: ["roar"], beat: "idle", playback: "once" }],
    upright("stand_idle", "idle"),
    upright("stand_roar", "idle"),
  ],
} as const)

export default BEAR_SPRITE

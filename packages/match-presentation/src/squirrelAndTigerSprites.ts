import createCelebrationRecipe from "./createCelebrationRecipe.js"
import defineStoryAnimalSprite from "./defineStoryAnimalSprite.js"
import type { SpriteReactionPlan } from "./presentationAssetManifest.js"
import source from "./squirrelAndTigerSpriteData.js"

function capture(
  locomotion: "run" | "dash",
  contactFrame: number,
  frameCount: number,
): SpriteReactionPlan<"run" | "dash" | "attack"> {
  return [
    { animationIds: [locomotion], beat: "approach", playback: "once" },
    {
      animationIds: ["attack"],
      beat: "strike",
      playback: "once",
      frames: [0, contactFrame],
    },
    {
      animationIds: ["attack"],
      beat: "reaction",
      playback: "once",
      frames: [contactFrame, frameCount],
    },
    { animationIds: [locomotion], beat: "recovery", playback: "once" },
  ]
}

const shared = {
  idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
  "capture-victim": [
    { animationIds: ["hurt"], beat: "reaction", playback: "once" },
  ],
  defeat: [
    {
      animationIds: ["die"],
      beat: "conclusion",
      playback: "once-hold-final-frame",
    },
  ],
} as const

const calmEnding = {
  animationIds: ["idle"],
  beat: "conclusion",
  playback: "once",
  pacing: "calm",
} as const
const jump = [
  ...createCelebrationRecipe("jump", "fall", "land"),
  calmEnding,
] as const

const squirrelCapture = (locomotion: "run" | "dash") =>
  capture(locomotion, 2, source.squirrel.clips.attack[0])
const tigerCapture = (locomotion: "run" | "dash") =>
  capture(locomotion, 3, source.tiger.clips.attack[0])

const SQUIRREL_AND_TIGER_SPRITES = Object.freeze({
  "squirrel-stockfish": defineStoryAnimalSprite(
    source.squirrel,
    {
      ...shared,
      "capture-attacker": squirrelCapture("run"),
      "check-attacker": [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      "check-victim": [
        { animationIds: ["idle_blink"], beat: "reaction", playback: "once" },
      ],
      victory: jump,
    },
    {
      "capture-attacker": [squirrelCapture("dash")],
    },
  ),
  "tiger-stockfish": defineStoryAnimalSprite(
    source.tiger,
    {
      ...shared,
      "capture-attacker": tigerCapture("run"),
      "check-attacker": [
        { animationIds: ["roar"], beat: "strike", playback: "once" },
      ],
      "check-victim": [
        { animationIds: ["fright"], beat: "reaction", playback: "once" },
      ],
      victory: [...createCelebrationRecipe("roar"), calmEnding],
    },
    {
      idle: [
        [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
        [{ animationIds: ["sit"], beat: "idle", playback: "loop" }],
      ],
      "capture-attacker": [tigerCapture("dash")],
      victory: [jump],
    },
  ),
})

export default SQUIRREL_AND_TIGER_SPRITES

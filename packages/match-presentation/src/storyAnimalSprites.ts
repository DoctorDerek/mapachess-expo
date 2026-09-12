import defineStoryAnimalSprite from "./defineStoryAnimalSprite.js"
import REMAINING_STORY_ANIMAL_SPRITES from "./remainingStoryAnimalSprites.js"
import STORY_ANIMAL_SPRITE_DATA from "./storyAnimalSpriteData.js"

const STORY_ANIMAL_SPRITES = Object.freeze({
  ...REMAINING_STORY_ANIMAL_SPRITES,
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

import defineStoryAnimalSprite from "./defineStoryAnimalSprite.js"
import REMAINING_ANIMAL_REACTION_ALTERNATIVES from "./remainingAnimalReactionAlternatives.js"
import REMAINING_STORY_ANIMAL_SPRITE_DATA from "./remainingStoryAnimalSpriteData.js"

const GROUND_STORY_ANIMAL_SPRITES = {
  "axolotl-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["axolotl"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
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
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.axolotl,
  ),
  "hedgehog-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["hedgehog"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
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
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.hedgehog,
  ),
  "deer-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["deer"],
    {
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
        { animationIds: ["alerted"], beat: "reaction", playback: "once" },
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
        { animationIds: ["alerted"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.deer,
  ),
  "fox-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["fox"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
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
        { animationIds: ["bark"], beat: "strike", playback: "once" },
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
        { animationIds: ["howl"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.fox,
  ),
  "wolf-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["wolf"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
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
        { animationIds: ["growl"], beat: "strike", playback: "once" },
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
        { animationIds: ["howl"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.wolf,
  ),
  "ninja-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["ninja"],
    {
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
        { animationIds: ["sit"], beat: "conclusion", playback: "loop" },
      ],
    },
  ),
  "war-hero-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["war-hero"],
    {
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
        { animationIds: ["sit"], beat: "conclusion", playback: "loop" },
      ],
    },
  ),
} as const

export default GROUND_STORY_ANIMAL_SPRITES

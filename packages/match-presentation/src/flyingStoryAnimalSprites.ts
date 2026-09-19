import defineStoryAnimalSprite from "./defineStoryAnimalSprite.js"
import REMAINING_ANIMAL_REACTION_ALTERNATIVES from "./remainingAnimalReactionAlternatives.js"
import REMAINING_STORY_ANIMAL_SPRITE_DATA from "./remainingStoryAnimalSpriteData.js"

const FLYING_STORY_ANIMAL_SPRITES = {
  "parrot-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["parrot"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
      "capture-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack_ground"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
      "capture-victim": [
        { animationIds: ["hurt"], beat: "reaction", playback: "once" },
      ],
      "check-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack_ground"], beat: "strike", playback: "once" },
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
        { animationIds: ["takeoff"], beat: "conclusion", playback: "once" },
        { animationIds: ["fly"], beat: "conclusion", playback: "once" },
        { animationIds: ["fall"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_caw"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.parrot,
  ),
  "falcon-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["falcon"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
      "capture-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack_ground"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
      "capture-victim": [
        { animationIds: ["hurt"], beat: "reaction", playback: "once" },
      ],
      "check-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack_ground"], beat: "strike", playback: "once" },
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
        { animationIds: ["takeoff"], beat: "conclusion", playback: "once" },
        { animationIds: ["fly"], beat: "conclusion", playback: "once" },
        { animationIds: ["fall"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_call"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.falcon,
  ),
  "crane-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["crane"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
      "capture-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
      "capture-victim": [
        { animationIds: ["hurt"], beat: "reaction", playback: "once" },
      ],
      "check-attacker": [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["call"], beat: "strike", playback: "once" },
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
        { animationIds: ["display"], beat: "conclusion", playback: "once" },
        { animationIds: ["dance"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.crane,
  ),
  "crow-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["crow"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
      "capture-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack_ground"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
      "capture-victim": [
        { animationIds: ["hurt"], beat: "reaction", playback: "once" },
      ],
      "check-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["attack_ground"], beat: "strike", playback: "once" },
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
        { animationIds: ["takeoff"], beat: "conclusion", playback: "once" },
        { animationIds: ["fly"], beat: "conclusion", playback: "once" },
        { animationIds: ["fall"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_caw"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.crow,
  ),
  "bat-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["bat"],
    {
      idle: [
        {
          animationIds: ["idle_upright"],
          beat: "idle",
          playback: "loop",
        },
      ],
      "capture-attacker": [
        { animationIds: ["fly_forward"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["land_upright"], beat: "recovery", playback: "once" },
      ],
      "capture-victim": [
        { animationIds: ["hurt"], beat: "reaction", playback: "once" },
      ],
      "check-attacker": [
        { animationIds: ["fly_forward"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["land_upright"], beat: "recovery", playback: "once" },
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
        { animationIds: ["fly_idle"], beat: "conclusion", playback: "once" },
        {
          animationIds: ["land_upright"],
          beat: "conclusion",
          playback: "once",
        },
        {
          animationIds: ["idle_upright_blink"],
          beat: "conclusion",
          playback: "loop",
        },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.bat,
  ),
  "dragonfly-stockfish": defineStoryAnimalSprite(
    REMAINING_STORY_ANIMAL_SPRITE_DATA["dragonfly"],
    {
      idle: [{ animationIds: ["idle"], beat: "idle", playback: "loop" }],
      "capture-attacker": [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
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
        { animationIds: ["fly_idle01"], beat: "conclusion", playback: "once" },
        { animationIds: ["fly_idle02"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_blink"], beat: "conclusion", playback: "loop" },
      ],
    },
    REMAINING_ANIMAL_REACTION_ALTERNATIVES.dragonfly,
  ),
} as const

export default FLYING_STORY_ANIMAL_SPRITES

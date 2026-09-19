import createCelebrationRecipe from "./createCelebrationRecipe.js"
import defineStoryAnimalSprite from "./defineStoryAnimalSprite.js"
import GROUND_ANIMAL_REACTION_ALTERNATIVES from "./groundAnimalReactionAlternatives.js"
import REMAINING_STORY_ANIMAL_SPRITES from "./remainingStoryAnimalSprites.js"
import STORY_ANIMAL_SPRITE_DATA from "./storyAnimalSpriteData.js"

const STORY_ANIMAL_SPRITES = Object.freeze({
  ...REMAINING_STORY_ANIMAL_SPRITES,
  "bunny-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.bunny,
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
      victory: createCelebrationRecipe("jump", "fall", "land", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.bunny,
  ),
  "dog-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.dog,
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
      victory: createCelebrationRecipe("bark", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.dog,
  ),
  "cat-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.cat,
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
      victory: createCelebrationRecipe("jump", "fall", "land", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.cat,
  ),
  "mouse-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.mouse,
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
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      "check-victim": [
        { animationIds: ["sniff"], beat: "reaction", playback: "once" },
      ],
      defeat: [
        {
          animationIds: ["die"],
          beat: "conclusion",
          playback: "once-hold-final-frame",
        },
      ],
      victory: createCelebrationRecipe("jump", "fall", "land", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.mouse,
  ),
  "frog-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.frog,
    {
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
      victory: createCelebrationRecipe("croak", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.frog,
  ),
  "turtle-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.turtle,
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
      victory: createCelebrationRecipe("jump", "fall", "land", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.turtle,
  ),
  "panda-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.panda,
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
        { animationIds: ["fright"], beat: "reaction", playback: "once" },
      ],
      defeat: [
        {
          animationIds: ["die"],
          beat: "conclusion",
          playback: "once-hold-final-frame",
        },
      ],
      victory: createCelebrationRecipe("idle_laugh", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.panda,
  ),
  "otter-stockfish": defineStoryAnimalSprite(
    STORY_ANIMAL_SPRITE_DATA.otter,
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
        { animationIds: ["crouch"], beat: "reaction", playback: "once" },
      ],
      defeat: [
        {
          animationIds: ["die"],
          beat: "conclusion",
          playback: "once-hold-final-frame",
        },
      ],
      victory: createCelebrationRecipe("jump", "fall", "land", "idle"),
    },
    GROUND_ANIMAL_REACTION_ALTERNATIVES.otter,
  ),
})

export default STORY_ANIMAL_SPRITES

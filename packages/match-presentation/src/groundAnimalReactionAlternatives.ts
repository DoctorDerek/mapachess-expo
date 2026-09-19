import createCelebrationRecipe from "./createCelebrationRecipe.js"

const GROUND_ANIMAL_REACTION_ALTERNATIVES = Object.freeze({
  bunny: {
    idle: [
      [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
      [{ animationIds: ["sit"], beat: "idle", playback: "loop" }],
    ],
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  dog: {
    victory: [createCelebrationRecipe("jump", "fall", "land", "idle")],
    idle: [
      [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
      [{ animationIds: ["sit"], beat: "idle", playback: "loop" }],
    ],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
    ],
    "check-attacker": [
      [
        { animationIds: ["walk"], beat: "approach", playback: "once" },
        { animationIds: ["growl"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  cat: {
    idle: [
      [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
      [{ animationIds: ["sit"], beat: "idle", playback: "loop" }],
    ],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["sneak"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["sneak"], beat: "recovery", playback: "once" },
      ],
    ],
    "check-attacker": [
      [
        { animationIds: ["sneak"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  mouse: {
    idle: [[{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }]],
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
    ],
    "check-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["sniff"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  frog: {
    victory: [createCelebrationRecipe("jump", "fall", "land", "idle")],
  },
  turtle: {
    idle: [[{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }]],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
    "capture-victim": [
      [
        { animationIds: ["hide"], beat: "reaction", playback: "once" },
        { animationIds: ["unhide"], beat: "reaction", playback: "once" },
      ],
    ],
    "check-victim": [
      [{ animationIds: ["fright"], beat: "reaction", playback: "once" }],
    ],
  },
  panda: {
    idle: [[{ animationIds: ["idle_laugh"], beat: "idle", playback: "loop" }]],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack02"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["bite"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
    victory: [createCelebrationRecipe("jump", "fall", "land", "idle")],
  },
  otter: {
    idle: [
      [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
      [{ animationIds: ["sit"], beat: "idle", playback: "loop" }],
    ],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["sneak"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["sneak"], beat: "recovery", playback: "once" },
      ],
    ],
    "check-attacker": [
      [
        { animationIds: ["sneak"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
      ],
    ],
  },
} as const)

export default GROUND_ANIMAL_REACTION_ALTERNATIVES

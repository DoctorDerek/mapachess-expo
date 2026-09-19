import createCelebrationRecipe from "./createCelebrationRecipe.js"

const REMAINING_ANIMAL_REACTION_ALTERNATIVES = Object.freeze({
  axolotl: {
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
  hedgehog: {
    idle: [[{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }]],
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
  deer: {
    idle: [[{ animationIds: ["eat"], beat: "idle", playback: "loop" }]],
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack02"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
    ],
    "check-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["alerted"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  fox: {
    idle: [
      [{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }],
      [{ animationIds: ["sit01"], beat: "idle", playback: "loop" }],
      [{ animationIds: ["sit02"], beat: "idle", playback: "loop" }],
    ],
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["dash"], beat: "recovery", playback: "once" },
      ],
    ],
    victory: [
      createCelebrationRecipe("bark", "idle"),
      createCelebrationRecipe("jump", "fall", "land", "idle"),
    ],
  },
  wolf: {
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
    victory: [createCelebrationRecipe("jump", "fall", "land", "idle")],
  },
  parrot: {
    idle: [[{ animationIds: ["idle_caw"], beat: "idle", playback: "loop" }]],
    victory: [
      createCelebrationRecipe("takeoff", "fly", "fall", "land", "idle"),
      createCelebrationRecipe("takeoff", "soar", "fall", "land", "idle"),
    ],
  },
  falcon: {
    idle: [[{ animationIds: ["idle_call"], beat: "idle", playback: "loop" }]],
    victory: [
      createCelebrationRecipe("takeoff", "fly", "fall", "land", "idle"),
      createCelebrationRecipe("takeoff", "soar", "fall", "land", "idle"),
      createCelebrationRecipe("takeoff", "soar_call", "fall", "land", "idle"),
    ],
  },
  crane: {
    idle: [[{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }]],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["peck"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
    victory: [
      createCelebrationRecipe("display", "idle"),
      createCelebrationRecipe("call", "idle"),
      createCelebrationRecipe("takeoff", "fly", "fall", "land", "idle"),
      createCelebrationRecipe("takeoff", "soar", "fall", "land", "idle"),
    ],
  },
  crow: {
    idle: [[{ animationIds: ["idle_caw"], beat: "idle", playback: "loop" }]],
    victory: [
      createCelebrationRecipe("takeoff", "fly", "fall", "land", "idle"),
      createCelebrationRecipe("takeoff", "soar", "fall", "land", "idle"),
    ],
  },
  bat: {
    idle: [
      [
        {
          animationIds: ["idle_upright_blink"],
          beat: "idle",
          playback: "loop",
        },
      ],
    ],
    "check-attacker": [
      [
        { animationIds: ["fly_forward"], beat: "approach", playback: "once" },
        { animationIds: ["fly_idle"], beat: "strike", playback: "once" },
        { animationIds: ["land_upright"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  dragonfly: {
    victory: [
      createCelebrationRecipe("fly_forward", "fly_idle02", "land", "idle"),
    ],
    idle: [[{ animationIds: ["idle_blink"], beat: "idle", playback: "loop" }]],
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
      [
        { animationIds: ["fly_forward"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["land"], beat: "recovery", playback: "once" },
      ],
    ],
  },
} as const)

export default REMAINING_ANIMAL_REACTION_ALTERNATIVES

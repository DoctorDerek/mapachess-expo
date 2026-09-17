const REMAINING_ANIMAL_REACTION_ALTERNATIVES = Object.freeze({
  axolotl: {
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
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
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
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
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack02"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
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
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
    victory: [
      [{ animationIds: ["howl"], beat: "conclusion", playback: "loop" }],
    ],
  },
  wolf: {
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
    victory: [
      [{ animationIds: ["howl"], beat: "conclusion", playback: "loop" }],
    ],
  },
  parrot: {
    victory: [
      [
        { animationIds: ["takeoff"], beat: "conclusion", playback: "once" },
        { animationIds: ["soar"], beat: "conclusion", playback: "once" },
        { animationIds: ["fall"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_caw"], beat: "conclusion", playback: "loop" },
      ],
    ],
  },
  falcon: {
    victory: [
      [
        { animationIds: ["takeoff"], beat: "conclusion", playback: "once" },
        { animationIds: ["soar_call"], beat: "conclusion", playback: "once" },
        { animationIds: ["fall"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_call"], beat: "conclusion", playback: "loop" },
      ],
    ],
  },
  crane: {
    victory: [
      [
        { animationIds: ["display"], beat: "conclusion", playback: "once" },
        { animationIds: ["call"], beat: "conclusion", playback: "loop" },
      ],
    ],
  },
  crow: {
    victory: [
      [
        { animationIds: ["takeoff"], beat: "conclusion", playback: "once" },
        { animationIds: ["soar"], beat: "conclusion", playback: "once" },
        { animationIds: ["fall"], beat: "conclusion", playback: "once" },
        { animationIds: ["land"], beat: "conclusion", playback: "once" },
        { animationIds: ["idle_caw"], beat: "conclusion", playback: "loop" },
      ],
    ],
  },
  bat: {
    "check-attacker": [
      [
        { animationIds: ["fly_forward"], beat: "approach", playback: "once" },
        { animationIds: ["fly_idle"], beat: "strike", playback: "once" },
        { animationIds: ["land_upright"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  dragonfly: {
    "capture-attacker": [
      [
        { animationIds: ["fly_forward"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["land"], beat: "recovery", playback: "once" },
      ],
    ],
  },
} as const)

export default REMAINING_ANIMAL_REACTION_ALTERNATIVES

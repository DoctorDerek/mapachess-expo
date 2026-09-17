const GROUND_ANIMAL_REACTION_ALTERNATIVES = Object.freeze({
  bunny: {
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
  },
  dog: {
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
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
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
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
    "capture-attacker": [
      [
        { animationIds: ["dash"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
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
    victory: [
      [{ animationIds: ["croak"], beat: "conclusion", playback: "loop" }],
    ],
  },
  turtle: {
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["attack"], beat: "strike", playback: "once" },
        { animationIds: ["walk"], beat: "recovery", playback: "once" },
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
    "capture-attacker": [
      [
        { animationIds: ["run"], beat: "approach", playback: "once" },
        { animationIds: ["bite"], beat: "strike", playback: "once" },
        { animationIds: ["run"], beat: "recovery", playback: "once" },
      ],
    ],
    victory: [
      [{ animationIds: ["idle_laugh"], beat: "conclusion", playback: "loop" }],
    ],
  },
  otter: {
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
} as const)

export default GROUND_ANIMAL_REACTION_ALTERNATIVES

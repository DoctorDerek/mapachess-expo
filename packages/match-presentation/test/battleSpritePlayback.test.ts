import { describe, expect, it } from "vitest"
import battleSpritePlayback from "../src/battleSpritePlayback.js"
import resolveOpponentPresentation from "../src/opponentPresentation.js"
import {
  battleSpriteContactAdvance,
  battleSpriteGeometry,
} from "../src/spritePresentationGeometry.js"

const tiger = resolveOpponentPresentation("tiger-stockfish", {
  family: "capture",
  role: "attacker",
})
const squirrel = resolveOpponentPresentation("squirrel-stockfish", {
  family: "capture",
  role: "victim",
})

describe("portable battle sprite playback", () => {
  it("keeps authored size and target contact independent of the renderer", () => {
    const dog = resolveOpponentPresentation("dog-stockfish")
    expect(battleSpriteGeometry(dog)).toMatchObject({
      kind: "sprite",
      sourceVisibleWidthPixels: 37,
      mobile: { integerScale: 3, visibleWidthPixels: 111 },
      desktop: { integerScale: 3, visibleWidthPixels: 111 },
    })
    expect(
      battleSpriteContactAdvance(tiger, squirrel, "strike"),
    ).toBeUndefined()
    expect(battleSpriteContactAdvance(tiger, squirrel, "reaction")).toBe(4)
    expect(battleSpriteContactAdvance(tiger, squirrel, "recovery")).toBe(4)
    expect(battleSpriteContactAdvance(tiger, dog, "reaction")).toBeUndefined()
  })

  it("keeps the authored strike, travel, recoil and return distinct", () => {
    const roar = resolveOpponentPresentation("tiger-stockfish", {
      family: "check",
      role: "attacker",
    })
    expect(
      battleSpritePlayback(tiger, "approach", "right", false),
    ).toMatchObject({
      facing: "right",
      travelTarget: "contact",
    })
    expect(
      battleSpritePlayback(tiger, "recovery", "right", false),
    ).toMatchObject({
      facing: "left",
      travelTarget: "home",
    })
    expect(battleSpritePlayback(roar, "strike", "right", false)).toMatchObject({
      facing: "right",
      travelTarget: "home",
      steps: [{ step: { animationId: "roar" } }],
    })
    expect(
      battleSpritePlayback(squirrel, "reaction", "left", false),
    ).toMatchObject({
      facing: "left",
      travelTarget: "recoil",
    })
    expect(
      battleSpritePlayback(squirrel, "reaction", "left", true).travelTarget,
    ).toBe("home")
  })

  it("retains the complete victory recipe while presenting only its last Reduced Motion step", () => {
    const victory = resolveOpponentPresentation(
      "raccoon-stockfish",
      {
        family: "victory",
      },
      1,
    )
    const motion = battleSpritePlayback(victory, "conclusion", "right", false)
    const still = battleSpritePlayback(victory, "conclusion", "right", true)
    expect(motion.steps.map(({ step }) => step.animationId)).toEqual([
      "jump",
      "fall",
      "land",
      "idle",
    ])
    expect(motion.repeatSequence).toBe(true)
    expect(still.repeatSequence).toBe(false)
    expect(still.steps.map(({ step }) => step.animationId)).toEqual(["idle"])
    expect(still.sources).toEqual(
      motion.steps.map(({ step }) => step.animation.sourceId),
    )
  })

  it("uses the authored duration and terminal held cell instead of restarting defeat", () => {
    const defeated = resolveOpponentPresentation("chicken-stockfish", {
      family: "defeat",
    })
    for (const reducedMotion of [false, true]) {
      expect(
        battleSpritePlayback(defeated, "conclusion", "left", reducedMotion),
      ).toMatchObject({
        repeatSequence: false,
        travelTarget: "home",
        steps: [
          {
            step: { animationId: "die", playback: "once-hold-final-frame" },
            frames: [0, 10],
            stillFrame: 9,
            durationMilliseconds: 1000,
          },
        ],
      })
    }
  })
})

import { describe, expect, it } from "vitest"
import resolveSpritePresentation from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  battleSpriteAnchorStyle,
  battleSpriteFrameKeyframes,
} from "./battleSpriteFrames"
import {
  CHICKEN_SPRITE_MANIFEST,
  CHICKEN_SPRITE_SOURCES,
  MAPACHITO_SPRITE_MANIFEST,
  MAPACHITO_SPRITE_SOURCES,
} from "./webPresentationAssets"

describe("battle frame and clip contracts", () => {
  it.each([1, 2, 7, 24])(
    "gives all %s frames an equal interval without addressing a frame beyond the strip",
    (count) => {
      const frames = battleSpriteFrameKeyframes(count)
      expect(frames).toHaveLength(count + 1)
      expect(frames[0]).toMatchObject({ backgroundPosition: "0% 0", offset: 0 })
      expect(frames.at(-1)).toMatchObject({
        backgroundPosition: count === 1 ? "0% 0" : "100% 0",
        offset: 1,
      })
      for (const [index, frame] of frames.entries()) {
        expect(frame.offset).toBe(index / count)
      }
      expect(frames.at(-1)?.backgroundPosition).toBe(
        frames.at(-2)?.backgroundPosition,
      )
    },
  )

  it.each([
    {
      name: "Chicken",
      manifest: CHICKEN_SPRITE_MANIFEST,
      sources: Object.values(CHICKEN_SPRITE_SOURCES),
    },
    {
      name: "Mapachito",
      manifest: MAPACHITO_SPRITE_MANIFEST,
      sources: Object.values(MAPACHITO_SPRITE_SOURCES),
    },
  ])(
    "maps $name strikes after locomotion, with separate recovery and reaction",
    ({ manifest, sources }) => {
      const attacker = resolveSpritePresentation<string, string>(
        manifest,
        { family: "capture", role: "attacker" },
        sources,
      )
      const victim = resolveSpritePresentation<string, string>(
        manifest,
        { family: "capture", role: "victim" },
        sources,
      )
      expect(attacker.kind).toBe("sprite")
      expect(victim.kind).toBe("sprite")
      if (attacker.kind !== "sprite" || victim.kind !== "sprite")
        throw new Error("Expected verified sprite metadata")
      expect(attacker.steps.map((step) => step.beat)).toEqual([
        "approach",
        "strike",
        "recovery",
      ])
      expect(victim.steps.map((step) => step.beat)).toEqual(["reaction"])
      expect(
        battleSpriteAnchorStyle(attacker)["--sprite-mobile-scale"],
      ).toBeGreaterThanOrEqual(1)
    },
  )
})

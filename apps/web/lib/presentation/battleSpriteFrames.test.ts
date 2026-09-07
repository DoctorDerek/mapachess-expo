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
  it("provides each fighter's authored width and the opposing responsive widths", () => {
    const player = resolveSpritePresentation(
      MAPACHITO_SPRITE_MANIFEST,
      { family: "idle" },
      Object.values(MAPACHITO_SPRITE_SOURCES),
    )
    const opponent = resolveSpritePresentation(
      CHICKEN_SPRITE_MANIFEST,
      { family: "idle" },
      Object.values(CHICKEN_SPRITE_SOURCES),
    )

    expect(battleSpriteAnchorStyle(player, opponent)).toEqual({
      "--sprite-mobile-scale": 3,
      "--sprite-desktop-scale": 4,
      "--sprite-visible-width": "29px",
      "--opponent-mobile-width": "calc(17px * 3)",
      "--opponent-desktop-width": "calc(17px * 4)",
    })
    expect(battleSpriteAnchorStyle(opponent, player)).toEqual({
      "--sprite-mobile-scale": 3,
      "--sprite-desktop-scale": 4,
      "--sprite-visible-width": "17px",
      "--opponent-mobile-width": "calc(29px * 3)",
      "--opponent-desktop-width": "calc(29px * 4)",
    })
  })

  it("leaves public-clone fallback size under CSS ownership", () => {
    const fallback = {
      kind: "authored-fallback",
      reactionSlot: "idle",
    } as const

    expect(battleSpriteAnchorStyle(fallback, fallback)).toEqual({
      "--sprite-mobile-scale": 1,
      "--sprite-desktop-scale": 1,
      "--sprite-visible-width": "var(--battle-fallback-size)",
      "--opponent-mobile-width": "calc(var(--battle-fallback-size) * 1)",
      "--opponent-desktop-width": "calc(var(--battle-fallback-size) * 1)",
    })
  })

  it("keeps fallback and licensed fighter dimensions independent", () => {
    const sprite = resolveSpritePresentation(
      CHICKEN_SPRITE_MANIFEST,
      { family: "idle" },
      Object.values(CHICKEN_SPRITE_SOURCES),
    )
    const fallback = {
      kind: "authored-fallback",
      reactionSlot: "idle",
    } as const

    expect(battleSpriteAnchorStyle(sprite, fallback)).toMatchObject({
      "--sprite-visible-width": "17px",
      "--opponent-mobile-width": "calc(var(--battle-fallback-size) * 1)",
    })
    expect(battleSpriteAnchorStyle(fallback, sprite)).toMatchObject({
      "--sprite-visible-width": "var(--battle-fallback-size)",
      "--opponent-mobile-width": "calc(17px * 3)",
    })
  })

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
        battleSpriteAnchorStyle(attacker, victim)["--sprite-mobile-scale"],
      ).toBeGreaterThanOrEqual(1)
    },
  )
})

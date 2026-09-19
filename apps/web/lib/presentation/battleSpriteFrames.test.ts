import { describe, expect, it } from "vitest"
import resolveSpritePresentation, {
  type SpriteAssetManifest,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  battleSpriteAnchorStyle,
  battleSpriteFrameKeyframes,
  battleSpriteFrameStyle,
} from "./battleSpriteFrames"
import {
  CHICKEN_SPRITE_MANIFEST,
  CHICKEN_SPRITE_SOURCES,
  MAPACHITO_SPRITE_MANIFEST,
  MAPACHITO_SPRITE_SOURCES,
} from "./webPresentationAssets"

describe("battle frame and clip contracts", () => {
  it.each([
    { name: "Chicken", manifest: CHICKEN_SPRITE_MANIFEST, fallback: ["peck"] },
    {
      name: "Raccoon",
      manifest: MAPACHITO_SPRITE_MANIFEST,
      fallback: ["bark", "crouch"],
    },
  ])(
    "keeps $name alarm fallback separate from capture hurt",
    ({ manifest, fallback }) => {
      const reaction = { family: "check", role: "victim" } as const
      const candidates = ["fright", ...fallback]
      for (
        let unavailable = 0;
        unavailable <= candidates.length;
        unavailable += 1
      ) {
        const sources = Object.entries(manifest.animations)
          .filter(([id]) => !candidates.slice(0, unavailable).includes(id))
          .map(([, animation]) => animation.sourceId)
        expect(
          resolveSpritePresentation<string, string>(
            manifest,
            reaction,
            sources,
          ),
        ).toMatchObject({
          kind: "sprite",
          steps: [
            {
              animationId: candidates[unavailable] ?? "idle",
              playback: unavailable === candidates.length ? "loop" : "once",
              animation: {
                frameDurationMilliseconds:
                  unavailable === candidates.length ? 160 : 100,
              },
            },
          ],
        })
        expect(
          resolveSpritePresentation<string, string>(
            manifest,
            { family: "capture", role: "victim" },
            sources,
          ),
        ).toMatchObject({
          kind: "sprite",
          steps: [{ animationId: "hurt", playback: "once" }],
        })
      }
    },
  )
  it.each([
    {
      name: "Raccoon",
      manifest: MAPACHITO_SPRITE_MANIFEST,
      travelPool: ["run", "dash"],
      attack: "attack",
    },
    {
      name: "Chicken",
      manifest: CHICKEN_SPRITE_MANIFEST,
      travelPool: ["walk", "run"],
      attack: "attack-ground",
    },
  ])(
    "keeps $name captures complete without substituting an unrelated expression",
    ({ manifest, travelPool, attack }) => {
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const reaction = { family: "capture", role: "attacker" } as const
      for (let ordinal = 0; ordinal <= travelPool.length; ordinal += 1) {
        const travel = travelPool[ordinal % travelPool.length]
        const result = resolveSpritePresentation<string, string>(
          manifest,
          reaction,
          sources,
          ordinal,
        )
        if (result.kind !== "sprite")
          throw new Error("Expected licensed sprite")
        expect(result.steps.map(({ animationId }) => animationId)).toEqual([
          travel,
          attack,
          travel,
        ])
        expect(
          result.steps.every(
            ({ playback, animation }) =>
              playback === "once" &&
              animation.frameDurationMilliseconds === 100,
          ),
        ).toBe(true)
      }
      for (const [ordinal, missing] of travelPool.entries()) {
        const fallback = (ordinal + 1) % travelPool.length
        expect(
          resolveSpritePresentation<string, string>(
            manifest,
            reaction,
            Object.entries(manifest.animations)
              .filter(([id]) => id !== missing)
              .map(([, animation]) => animation.sourceId),
            ordinal,
          ),
        ).toEqual(
          resolveSpritePresentation<string, string>(
            manifest,
            reaction,
            sources,
            fallback,
          ),
        )
      }
      expect(
        resolveSpritePresentation<string, string>(
          manifest,
          reaction,
          Object.entries(manifest.animations)
            .filter(([id]) => id !== attack)
            .map(([, animation]) => animation.sourceId),
        ),
      ).toMatchObject({
        kind: "sprite",
        steps: [
          {
            animationId: "idle",
            playback: "loop",
            animation: { frameDurationMilliseconds: 160 },
          },
        ],
      })
    },
  )
  it.each([CHICKEN_SPRITE_MANIFEST, MAPACHITO_SPRITE_MANIFEST])(
    "resolves calm animal pacing while preserving action and recovery pacing",
    (manifest: SpriteAssetManifest<string, string>) => {
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const idle = resolveSpritePresentation(
        manifest,
        { family: "idle" },
        sources,
      )
      const action = resolveSpritePresentation(
        manifest,
        { family: "capture", role: "attacker" },
        sources,
      )
      if (idle.kind !== "sprite" || action.kind !== "sprite")
        throw new Error("Expected licensed sprite")
      expect(idle.steps[0].animation.frameDurationMilliseconds).toBe(160)
      for (const step of action.steps)
        expect(step.animation.frameDurationMilliseconds).toBe(100)
      expect(action.layout).toEqual(idle.layout)
    },
  )
  it("derives the initial pose crop from its canonical animation geometry", () => {
    const presentation = resolveSpritePresentation(
      CHICKEN_SPRITE_MANIFEST,
      { family: "idle" },
      Object.values(CHICKEN_SPRITE_SOURCES),
    )
    if (presentation.kind !== "sprite")
      throw new Error("Expected licensed sprite")
    const step = presentation.steps[0]
    const initial = battleSpriteFrameStyle(step, false)
    expect(initial).toMatchObject({
      backgroundImage: `url("${step.animation.sourceId}")`,
      backgroundPosition: "0% 0",
      backgroundSize: `${step.animation.frameCount * 100}% 100%`,
      height: `calc(${step.animation.geometry.frameHeight}px * var(--sprite-scale))`,
    })
    expect(battleSpriteFrameStyle(step, true).backgroundPosition).toBe(
      `${(step.animation.reducedMotionFrameIndex / (step.animation.frameCount - 1)) * 100}% 0`,
    )
  })

  it("selects the held final defeat frame for decoded Reduced Motion playback", () => {
    const presentation = resolveSpritePresentation(
      CHICKEN_SPRITE_MANIFEST,
      { family: "defeat" },
      Object.values(CHICKEN_SPRITE_SOURCES),
    )
    if (presentation.kind !== "sprite")
      throw new Error("Expected licensed sprite")
    const step = presentation.steps.at(-1)
    if (step === undefined) throw new Error("Expected defeat frame")
    expect(step.playback).toBe("once-hold-final-frame")
    expect(battleSpriteFrameStyle(step, true).backgroundPosition).toBe("100% 0")
  })

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
      "--sprite-desktop-scale": 3,
      "--sprite-visible-width": "29px",
      "--opponent-mobile-width": "calc(17px * 3)",
      "--opponent-desktop-width": "calc(17px * 3)",
    })
    expect(battleSpriteAnchorStyle(opponent, player)).toEqual({
      "--sprite-mobile-scale": 3,
      "--sprite-desktop-scale": 3,
      "--sprite-visible-width": "17px",
      "--opponent-mobile-width": "calc(29px * 3)",
      "--opponent-desktop-width": "calc(29px * 3)",
    })
  })

  it("leaves public-clone fallback size under CSS ownership", () => {
    const fallback = resolveSpritePresentation(
      CHICKEN_SPRITE_MANIFEST,
      { family: "idle" },
      [],
    )

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
    const fallback = resolveSpritePresentation(
      CHICKEN_SPRITE_MANIFEST,
      { family: "idle" },
      [],
    )

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

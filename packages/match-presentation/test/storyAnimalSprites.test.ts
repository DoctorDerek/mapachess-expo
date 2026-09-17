import { describe, expect, it } from "vitest"
import type { MatchParticipantReaction } from "../src/matchReaction"
import resolveSpritePresentation, {
  resolveSpriteAttention,
  type SpriteAssetManifest,
} from "../src/presentationAssetManifest"
import REMAINING_STORY_ANIMAL_SPRITES from "../src/remainingStoryAnimalSprites"
import STORY_ANIMAL_SPRITES from "../src/storyAnimalSprites"

const REACTIONS = [
  { family: "idle" },
  { family: "capture", role: "attacker" },
  { family: "capture", role: "victim" },
  { family: "check", role: "attacker" },
  { family: "check", role: "victim" },
  { family: "victory" },
  { family: "defeat" },
] as const satisfies readonly MatchParticipantReaction[]

describe("complete Story animal presentation", () => {
  it.each([
    ["frog-stockfish", "croak"],
    ["panda-stockfish", "idle_laugh"],
  ] as const)(
    "%s can celebrate without an airborne compound",
    (id, expected) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const result = resolveSpritePresentation(
        manifest,
        { family: "victory" },
        sources,
        1,
      )
      expect(
        result.kind === "sprite" &&
          result.steps.map(({ animationId, playback }) => [
            animationId,
            playback,
          ]),
      ).toEqual([[expected, "loop"]])
      expect(result.layout).toEqual(
        resolveSpritePresentation(
          { ...manifest, reactionAlternatives: {} },
          { family: "idle" },
          sources,
        ).layout,
      )
    },
  )
  it.each([
    ["bunny-stockfish", "dash"],
    ["dog-stockfish", "dash"],
    ["cat-stockfish", "dash"],
    ["mouse-stockfish", "dash"],
    ["turtle-stockfish", "run"],
    ["panda-stockfish", "run"],
    ["otter-stockfish", "dash"],
  ] as const)(
    "%s selects a complete ground alternative without changing reserved scale or clearance",
    (id, approach) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const reaction = { family: "capture", role: "attacker" } as const
      const base = resolveSpritePresentation(manifest, reaction, sources, 0)
      const alternative = resolveSpritePresentation(
        manifest,
        reaction,
        sources,
        1,
      )
      if (base.kind !== "sprite" || alternative.kind !== "sprite")
        throw new Error("Expected licensed sprite")
      expect(alternative.steps.map(({ beat }) => beat)).toEqual([
        "approach",
        "strike",
        "recovery",
      ])
      expect(alternative.steps[0].animationId).toBe(approach)
      expect(
        alternative.steps.map(({ animationId }) => animationId),
      ).not.toEqual(base.steps.map(({ animationId }) => animationId))
      expect(resolveSpritePresentation(manifest, reaction, sources, 1)).toEqual(
        alternative,
      )
      expect(resolveSpritePresentation(manifest, reaction, sources, 2)).toEqual(
        base,
      )
      expect(alternative.layout).toEqual(
        resolveSpritePresentation(
          { ...manifest, reactionAlternatives: {} },
          reaction,
          sources,
        ).layout,
      )
      for (const currentReaction of REACTIONS) {
        const resolved = resolveSpritePresentation(
          manifest,
          currentReaction,
          sources,
          1,
        )
        if (resolved.kind !== "sprite")
          throw new Error("Expected licensed sprite")
        expect(resolved.layout.standaloneScale).toBe(3)
        for (const { animation, animationId } of resolved.steps) {
          expect(animation.frameDurationMilliseconds).toBe(
            currentReaction.family === "idle" ? 160 : 100,
          )
          expect(animationId).not.toMatch(
            /swim|wall|ledge|sleep|liedown|attackup|attackdiagonal/,
          )
        }
      }
    },
  )

  it.each([
    ["dog-stockfish", ["walk", "growl", "walk"]],
    ["cat-stockfish", ["sneak", "attack", "walk"]],
    ["mouse-stockfish", ["run", "sniff", "run"]],
    ["otter-stockfish", ["sneak", "attack", "walk"]],
  ] as const)(
    "%s uses its source-specific check expression",
    (id, expected) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const result = resolveSpritePresentation(
        manifest,
        { family: "check", role: "attacker" },
        Object.values(manifest.animations).map(({ sourceId }) => sourceId),
        1,
      )
      expect(
        result.kind === "sprite" &&
          result.steps.map(({ animationId }) => animationId),
      ).toEqual(expected)
    },
  )

  it("keeps the turtle capture retreat paired and falls back before hiding if recovery is unavailable", () => {
    const manifest = STORY_ANIMAL_SPRITES["turtle-stockfish"]
    const sources = Object.values(manifest.animations).map(
      ({ sourceId }) => sourceId,
    )
    const reaction = { family: "capture", role: "victim" } as const
    const complete = resolveSpritePresentation(manifest, reaction, sources, 1)
    expect(
      complete.kind === "sprite" &&
        complete.steps.map(({ animationId }) => animationId),
    ).toEqual(["hide", "unhide"])
    const withoutRecovery = Object.entries(manifest.animations)
      .filter(([id]) => id !== "unhide")
      .map(([, animation]) => animation.sourceId)
    const recovered = resolveSpritePresentation(
      manifest,
      reaction,
      withoutRecovery,
      1,
    )
    expect(
      recovered.kind === "sprite" &&
        recovered.steps.map(({ animationId }) => animationId),
    ).toEqual(["hurt"])
  })

  it("selects complete alternatives by reaction identity without reshuffling fallback order", () => {
    const dog = STORY_ANIMAL_SPRITES["dog-stockfish"]
    const manifest: SpriteAssetManifest<string, string> = {
      ...dog,
      reactionAlternatives: {
        victory: [
          [
            {
              animationIds: ["bark", "idle"],
              beat: "conclusion",
              playback: "loop",
            },
          ],
        ],
      },
    }
    const sources = Object.values(dog.animations).map(
      ({ sourceId }) => sourceId,
    )
    const resolve = (sequence: number, available = sources) =>
      resolveSpritePresentation(
        manifest,
        { family: "victory" },
        available,
        sequence,
      )
    const initial = resolve(0)
    const alternative = resolve(1)
    expect(
      initial.kind === "sprite" &&
        initial.steps.map(({ animationId }) => animationId),
    ).toEqual(["jump", "fall", "land", "bark"])
    expect(
      alternative.kind === "sprite" &&
        alternative.steps.map(({ animationId }) => animationId),
    ).toEqual(["bark"])
    expect(resolve(1)).toEqual(alternative)
    expect(resolve(2)).toEqual(initial)
    expect(alternative.layout).toEqual(initial.layout)
    const withoutLand = Object.entries(dog.animations)
      .filter(([id]) => id !== "land")
      .map(([, animation]) => animation.sourceId)
    expect(resolve(0, withoutLand)).toEqual(alternative)
    const withoutBark = Object.entries(dog.animations)
      .filter(([id]) => id !== "bark")
      .map(([, animation]) => animation.sourceId)
    const fallback = resolve(1, withoutBark)
    expect(
      fallback.kind === "sprite" &&
        fallback.steps.map(({ animationId }) => animationId),
    ).toEqual(["idle"])
    expect(resolve(1, []).kind).toBe("authored-fallback")
  })

  it("skips an incomplete compound alternative instead of mixing its phases with the base", () => {
    const turtle = STORY_ANIMAL_SPRITES["turtle-stockfish"]
    const manifest: SpriteAssetManifest<string, string> = {
      ...turtle,
      reactionAlternatives: {
        victory: [
          [
            { animationIds: ["hide"], beat: "conclusion", playback: "once" },
            { animationIds: ["unhide"], beat: "conclusion", playback: "once" },
            { animationIds: ["idle"], beat: "conclusion", playback: "loop" },
          ],
        ],
      },
    }
    const sources = Object.entries(turtle.animations)
      .filter(([id]) => id !== "unhide")
      .map(([, animation]) => animation.sourceId)
    const presentation = resolveSpritePresentation(
      manifest,
      { family: "victory" },
      sources,
      1,
    )
    expect(
      presentation.kind === "sprite" &&
        presentation.steps.map(({ animationId }) => animationId),
    ).toEqual(["jump", "fall", "land", "idle_blink"])
  })

  it("resolves optional attention without substituting unavailable or human artwork", () => {
    const dog = STORY_ANIMAL_SPRITES["dog-stockfish"]
    const sources = Object.values(dog.animations).map(
      ({ sourceId }) => sourceId,
    )
    const attention = resolveSpriteAttention(dog, sources)
    expect(attention?.animationId).toBe("bark")
    expect(attention?.animation.frameDurationMilliseconds).toBe(100)
    expect(attention?.playback).toBe("once")
    expect(resolveSpriteAttention(dog, [])).toBeNull()
    const ninja = STORY_ANIMAL_SPRITES["ninja-stockfish"]
    expect(
      resolveSpriteAttention(
        ninja,
        Object.values(ninja.animations).map(({ sourceId }) => sourceId),
      ),
    ).toBeNull()
  })
  it.each(Object.entries(STORY_ANIMAL_SPRITES))(
    "%s resolves calm pacing without slowing battle actions or changing source definitions",
    (id, manifest) => {
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const human = id === "ninja-stockfish" || id === "war-hero-stockfish"
      for (const reaction of REACTIONS) {
        const result = resolveSpritePresentation(manifest, reaction, sources)
        if (result.kind !== "sprite") throw new Error("Expected sprite")
        for (const { animation } of result.steps) {
          expect(animation.frameDurationMilliseconds).toBe(
            reaction.family === "idle" && !human ? 160 : 100,
          )
        }
      }
      for (const animation of Object.values(manifest.animations))
        expect(animation.frameDurationMilliseconds).toBe(100)
    },
  )
  it.each(Object.entries(STORY_ANIMAL_SPRITES))(
    "%s preserves full-repertoire clearance across reactions and asset availability",
    (id, manifest) => {
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const idle = resolveSpritePresentation(
        manifest,
        { family: "idle" },
        sources,
      )
      expect(idle.layout.standaloneScale).toBe(
        id === "ninja-stockfish" || id === "war-hero-stockfish" ? undefined : 3,
      )
      for (const reaction of REACTIONS) {
        expect(
          resolveSpritePresentation(manifest, reaction, sources).layout,
        ).toEqual(idle.layout)
        expect(
          resolveSpritePresentation(manifest, reaction, []).layout,
        ).toEqual(idle.layout)
      }
    },
  )
  it("composes the remaining roster without duplicating Chicken or Mapachito", () => {
    expect(Object.keys(REMAINING_STORY_ANIMAL_SPRITES)).toHaveLength(13)
    expect(Object.keys(STORY_ANIMAL_SPRITES)).toHaveLength(21)
    expect(STORY_ANIMAL_SPRITES).not.toHaveProperty("chicken-stockfish")
    expect(STORY_ANIMAL_SPRITES).not.toHaveProperty("raccoon-stockfish")
  })

  for (const [opponent, manifest] of Object.entries(
    REMAINING_STORY_ANIMAL_SPRITES,
  )) {
    const sources = Object.values(manifest.animations).map(
      ({ sourceId }) => sourceId,
    )

    it(`${opponent} resolves every reaction with valid source geometry`, () => {
      for (const reaction of REACTIONS) {
        const result = resolveSpritePresentation(manifest, reaction, sources)
        if (result.kind !== "sprite")
          throw new Error("Licensed reaction expected")
        expect(result.referenceGeometry).toBe(manifest.referenceGeometry)
        for (const { animation } of result.steps) {
          expect(animation.reducedMotionFrameIndex).toBeGreaterThanOrEqual(0)
          expect(animation.reducedMotionFrameIndex).toBeLessThan(
            animation.frameCount,
          )
          expect(animation.geometry.visibleWidth).toBeGreaterThan(0)
          expect(animation.geometry.visibleHeight).toBeGreaterThan(0)
          expect(
            animation.geometry.visibleX + animation.geometry.visibleWidth,
          ).toBeLessThanOrEqual(animation.geometry.frameWidth)
          expect(
            animation.geometry.visibleY + animation.geometry.visibleHeight,
          ).toBeLessThanOrEqual(animation.geometry.frameHeight)
          expect(animation.geometry.bottomY).toBeGreaterThanOrEqual(
            manifest.referenceGeometry.bottomY,
          )
          expect(
            animation.geometry.visibleY + animation.geometry.visibleHeight,
          ).toBeLessThanOrEqual(animation.geometry.bottomY)
          expect(animation.geometry.bottomCenterX).toBe(
            manifest.referenceGeometry.bottomCenterX,
          )
        }
      }
    })

    it(`${opponent} provides directed capture phases and holds its defeat pose`, () => {
      const capture = resolveSpritePresentation(
        manifest,
        { family: "capture", role: "attacker" },
        sources,
      )
      if (capture.kind !== "sprite") throw new Error("Capture expected")
      expect(capture.steps.map(({ beat }) => beat)).toEqual([
        "approach",
        "strike",
        "recovery",
      ])
      const defeat = resolveSpritePresentation(
        manifest,
        { family: "defeat" },
        sources,
      )
      if (defeat.kind !== "sprite") throw new Error("Defeat expected")
      expect(defeat.steps[0].playback).toBe("once-hold-final-frame")
      expect(defeat.steps[0].animation.reducedMotionFrameIndex).toBe(
        defeat.steps[0].animation.frameCount - 1,
      )
    })

    it(`${opponent} retains the intentional unlicensed fallback`, () => {
      for (const reaction of REACTIONS) {
        expect(resolveSpritePresentation(manifest, reaction, []).kind).toBe(
          "authored-fallback",
        )
      }
    })

    it(`${opponent} retains an idle pose when a requested attack is unavailable`, () => {
      const idle = resolveSpritePresentation(
        manifest,
        { family: "idle" },
        sources,
      )
      if (idle.kind !== "sprite") throw new Error("Idle expected")
      const result = resolveSpritePresentation(
        manifest,
        { family: "capture", role: "attacker" },
        [idle.steps[0].animation.sourceId],
      )
      if (result.kind !== "sprite") throw new Error("Visible idle expected")
      expect(
        result.steps.every(
          ({ animationId }) => animationId === idle.steps[0].animationId,
        ),
      ).toBe(true)
    })
  }

  it("uses Bat's actual upright reference pose without requesting a fictitious idle file", () => {
    const bat = REMAINING_STORY_ANIMAL_SPRITES["bat-stockfish"]
    expect(bat.animations).not.toHaveProperty("idle")
    expect(bat.animations.idle_upright?.sourceId).toBe(
      "battle/bat/bat_idle_upright_strip4.png",
    )
    expect(bat.referenceGeometry).toEqual(bat.animations.idle_upright?.geometry)
  })

  it("keeps explicitly offset attack and flight clips above the Stage floor", () => {
    const bat = REMAINING_STORY_ANIMAL_SPRITES["bat-stockfish"]
    const ninja = REMAINING_STORY_ANIMAL_SPRITES["ninja-stockfish"]
    const dragonfly = REMAINING_STORY_ANIMAL_SPRITES["dragonfly-stockfish"]
    expect(bat.animations.attack?.geometry.bottomY).toBe(27)
    expect(bat.animations.fly_forward?.geometry.bottomY).toBe(27)
    expect(bat.animations.fly_idle?.geometry.bottomY).toBe(27)
    expect(ninja.animations.attack02?.geometry.bottomY).toBe(56)
    expect(dragonfly.animations.fly_idle02?.geometry.bottomY).toBe(29)
    expect(dragonfly.animations.hurt?.geometry.bottomY).toBe(28)
  })

  it("preserves Hedgehog's exceptional fall filename and excludes separate shuriken effects", () => {
    expect(
      REMAINING_STORY_ANIMAL_SPRITES["hedgehog-stockfish"].animations.fall
        ?.sourceId,
    ).toBe("battle/hedgehog/hedgehog_fall_strip1.png")
    expect(
      Object.keys(REMAINING_STORY_ANIMAL_SPRITES["ninja-stockfish"].animations),
    ).not.toContain("shuriken_idle")
    expect(
      Object.keys(REMAINING_STORY_ANIMAL_SPRITES["ninja-stockfish"].animations),
    ).not.toContain("shuriken_spin")
  })
})

import { describe, expect, it } from "vitest"
import type { MatchParticipantReaction } from "../src/matchReaction"
import resolveSpritePresentation from "../src/presentationAssetManifest"
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

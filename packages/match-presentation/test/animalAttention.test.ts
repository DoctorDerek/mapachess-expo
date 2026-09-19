import { describe, expect, it } from "vitest"
import { createActor } from "xstate"
import animalAttentionMachine from "../src/animalAttentionMachine.js"
import { resolveSpriteAttention } from "../src/presentationAssetManifest.js"
import STORY_ANIMAL_SPRITES from "../src/storyAnimalSprites.js"

describe("shared animal attention", () => {
  it("retains calm selection through attention and advances only on surface reentry", () => {
    const actor = createActor(animalAttentionMachine).start()
    const input = (active: boolean, attention = false) =>
      actor.send({ type: "ANIMAL_ATTENTION.INPUT_CHANGED", active, attention })
    input(false)
    expect(actor.getSnapshot().context.calmOrdinal).toBe(-1)
    input(true)
    input(true)
    input(true, true)
    actor.send({ type: "ANIMAL_ATTENTION.COMPLETED", ordinal: 0 })
    input(true, false)
    input(true, true)
    expect(actor.getSnapshot().context.calmOrdinal).toBe(0)
    input(false, true)
    input(true, true)
    expect(actor.getSnapshot().context.calmOrdinal).toBe(1)
    expect(actor.getSnapshot().matches("resting")).toBe(true)
    actor.send({ type: "ANIMAL_ATTENTION.COMPLETED", ordinal: 0 })
    expect(actor.getSnapshot().context.calmOrdinal).toBe(1)
    actor.stop()
    const fresh = createActor(animalAttentionMachine).start()
    expect(fresh.getSnapshot().context.calmOrdinal).toBe(-1)
    fresh.stop()
  })
  it("advances only on a new combined input entry and ignores stale completion", () => {
    const actor = createActor(animalAttentionMachine).start()
    const input = (attention: boolean, active = true) =>
      actor.send({ type: "ANIMAL_ATTENTION.INPUT_CHANGED", active, attention })
    input(true)
    expect(actor.getSnapshot().context.ordinal).toBe(0)
    input(true)
    actor.send({ type: "ANIMAL_ATTENTION.COMPLETED", ordinal: 0 })
    expect(actor.getSnapshot().matches("resting")).toBe(true)
    input(true)
    expect(actor.getSnapshot().matches("resting")).toBe(true)
    input(false)
    input(true)
    expect(actor.getSnapshot().context.ordinal).toBe(1)
    actor.send({ type: "ANIMAL_ATTENTION.COMPLETED", ordinal: 0 })
    expect(actor.getSnapshot().matches("attention")).toBe(true)
    input(true, false)
    input(true)
    expect(actor.getSnapshot().matches("resting")).toBe(true)
    expect(actor.getSnapshot().context.ordinal).toBe(1)
    input(false)
    input(true)
    expect(actor.getSnapshot().context.ordinal).toBe(2)
    actor.stop()
    const fresh = createActor(animalAttentionMachine).start()
    expect(fresh.getSnapshot().context.ordinal).toBe(-1)
    fresh.stop()
  })

  it("does not start or consume attention while the surface is inactive", () => {
    const actor = createActor(animalAttentionMachine).start()
    actor.send({
      type: "ANIMAL_ATTENTION.INPUT_CHANGED",
      active: false,
      attention: true,
    })
    expect(actor.getSnapshot().matches("resting")).toBe(true)
    expect(actor.getSnapshot().context.ordinal).toBe(-1)
    actor.stop()
  })

  it("rotates approved complete attention clips and skips unavailable sources", () => {
    const dog = STORY_ANIMAL_SPRITES["dog-stockfish"]
    const sources = Object.values(dog.animations).map(
      ({ sourceId }) => sourceId,
    )
    expect(
      [0, 1, 2, 3].map(
        (ordinal) => resolveSpriteAttention(dog, sources, ordinal)?.animationId,
      ),
    ).toEqual(["bark", "growl", "crouch", "bark"])
    const withoutGrowl = sources.filter(
      (source) => source !== dog.animations.growl?.sourceId,
    )
    expect(resolveSpriteAttention(dog, withoutGrowl, 1)?.animationId).toBe(
      "crouch",
    )
    expect(resolveSpriteAttention(dog, [], 1)).toBeNull()
    expect(
      resolveSpriteAttention(STORY_ANIMAL_SPRITES["ninja-stockfish"], sources),
    ).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import resolveSpritePresentation from "../src/presentationAssetManifest"
import STORY_ANIMAL_SPRITES from "../src/storyAnimalSprites"

describe("shared terminal celebration recipes", () => {
  it.each([
    ["bunny-stockfish", [["jump", "fall", "land", "idle"]]],
    [
      "dog-stockfish",
      [
        ["bark", "idle"],
        ["jump", "fall", "land", "idle"],
      ],
    ],
    ["cat-stockfish", [["jump", "fall", "land", "idle"]]],
    ["mouse-stockfish", [["jump", "fall", "land", "idle"]]],
    [
      "frog-stockfish",
      [
        ["croak", "idle"],
        ["jump", "fall", "land", "idle"],
      ],
    ],
    ["turtle-stockfish", [["jump", "fall", "land", "idle"]]],
    [
      "panda-stockfish",
      [
        ["idle_laugh", "idle"],
        ["jump", "fall", "land", "idle"],
      ],
    ],
    ["otter-stockfish", [["jump", "fall", "land", "idle"]]],
    ["axolotl-stockfish", [["jump", "fall", "land", "idle"]]],
    ["hedgehog-stockfish", [["jump", "fall", "land", "idle"]]],
    ["deer-stockfish", [["jump", "fall", "land", "idle"]]],
    [
      "fox-stockfish",
      [
        ["howl", "idle"],
        ["bark", "idle"],
        ["jump", "fall", "land", "idle"],
      ],
    ],
    [
      "wolf-stockfish",
      [
        ["howl", "idle"],
        ["jump", "fall", "land", "idle"],
      ],
    ],
    [
      "parrot-stockfish",
      [
        ["idle_caw", "idle"],
        ["takeoff", "fly", "fall", "land", "idle"],
        ["takeoff", "soar", "fall", "land", "idle"],
      ],
    ],
    [
      "falcon-stockfish",
      [
        ["idle_call", "idle"],
        ["takeoff", "fly", "fall", "land", "idle"],
        ["takeoff", "soar", "fall", "land", "idle"],
        ["takeoff", "soar_call", "fall", "land", "idle"],
      ],
    ],
    [
      "crane-stockfish",
      [
        ["dance", "idle"],
        ["display", "idle"],
        ["call", "idle"],
        ["takeoff", "fly", "fall", "land", "idle"],
        ["takeoff", "soar", "fall", "land", "idle"],
      ],
    ],
    [
      "crow-stockfish",
      [
        ["idle_caw", "idle"],
        ["takeoff", "fly", "fall", "land", "idle"],
        ["takeoff", "soar", "fall", "land", "idle"],
      ],
    ],
    [
      "bat-stockfish",
      [["fly_forward", "fly_idle", "land_upright", "idle_upright"]],
    ],
    [
      "dragonfly-stockfish",
      [
        ["fly_forward", "fly_idle01", "land", "idle"],
        ["fly_forward", "fly_idle02", "land", "idle"],
      ],
    ],
  ] as const)(
    "%s selects and repeats complete approved recipes",
    (id, recipes) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      for (let ordinal = 0; ordinal <= recipes.length; ordinal += 1) {
        const result = resolveSpritePresentation(
          manifest,
          { family: "victory" },
          sources,
          ordinal,
        )
        if (result.kind !== "sprite")
          throw new Error("Expected complete celebration")
        expect(result.repeatSequence).toBe(true)
        expect(result.steps.map(({ animationId }) => animationId)).toEqual(
          recipes[ordinal % recipes.length],
        )
        expect(
          result.steps.every(
            ({ playback, beat, animation }) =>
              playback === "once" &&
              beat === "conclusion" &&
              animation.frameDurationMilliseconds === 100,
          ),
        ).toBe(true)
        expect(
          resolveSpritePresentation(
            manifest,
            { family: "victory" },
            sources,
            ordinal,
          ),
        ).toEqual(result)
      }
      for (const [ordinal, recipe] of recipes.entries()) {
        for (const missing of recipe.slice(0, -1)) {
          const available = Object.entries(manifest.animations)
            .filter(([id]) => id !== missing)
            .map(([, animation]) => animation.sourceId)
          const result = resolveSpritePresentation(
            manifest,
            { family: "victory" },
            available,
            ordinal,
          )
          if (result.kind !== "sprite")
            throw new Error("Expected complete recipe or calm fallback")
          const ordered = [
            ...recipes.slice(ordinal),
            ...recipes.slice(0, ordinal),
          ]
          const expected = ordered.find(
            (candidate) => !candidate.some((id) => id === missing),
          )
          expect(result.steps.map(({ animationId }) => animationId)).toEqual(
            expected ?? [recipe.at(-1)],
          )
          expect(result.repeatSequence).toBe(
            expected === undefined ? undefined : true,
          )
        }
      }
      expect(
        resolveSpritePresentation(manifest, { family: "victory" }, []).kind,
      ).toBe("authored-fallback")
      for (const reaction of [
        { family: "idle" },
        { family: "defeat" },
      ] as const) {
        const result = resolveSpritePresentation(manifest, reaction, sources)
        if (result.kind !== "sprite")
          throw new Error("Expected licensed sprite")
        expect(result.repeatSequence).toBeUndefined()
      }
    },
  )
  it.each(["ninja-stockfish", "war-hero-stockfish"] as const)(
    "preserves %s outside animal policy",
    (id) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      expect(manifest.repeatVictory).toBeUndefined()
    },
  )
})

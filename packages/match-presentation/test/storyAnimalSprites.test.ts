import { describe, expect, it } from "vitest"
import type { MatchParticipantReaction } from "../src/matchReaction"
import resolveSpritePresentation, {
  matchSpriteReactionSlot,
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
  it("uses another approved calm pose when the primary rest and battle recipe are unavailable", () => {
    const manifest = STORY_ANIMAL_SPRITES["dog-stockfish"]
    const sources = Object.entries(manifest.animations)
      .filter(([id]) => id === "idle_blink")
      .map(([, animation]) => animation.sourceId)
    for (const reaction of [
      { family: "idle" },
      { family: "capture", role: "attacker" },
    ] as const) {
      expect(
        resolveSpritePresentation(manifest, reaction, sources),
      ).toMatchObject({
        kind: "sprite",
        steps: [
          {
            animationId: "idle_blink",
            playback: "loop",
            animation: { frameDurationMilliseconds: 160 },
          },
        ],
      })
    }
  })
  it.each([
    ["bunny-stockfish", "sit", 2],
    ["dog-stockfish", "sit", 2],
    ["cat-stockfish", "sit", 2],
    ["otter-stockfish", "sit", 2],
    ["axolotl-stockfish", "sit", 2],
    ["deer-stockfish", "eat", 1],
    ["fox-stockfish", "sit01", 2],
    ["fox-stockfish", "sit02", 3],
    ["wolf-stockfish", "sit", 2],
  ] as const)(
    "%s rests with %s without changing scale or clearance",
    (id, expected, sequence) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const reaction = { family: "idle" } as const
      const result = resolveSpritePresentation(
        manifest,
        reaction,
        sources,
        sequence,
      )
      if (result.kind !== "sprite") throw new Error("Expected licensed sprite")
      expect(
        result.steps.map(({ animationId, playback, beat, animation }) => [
          animationId,
          playback,
          beat,
          animation.frameDurationMilliseconds,
        ]),
      ).toEqual([[expected, "loop", "idle", 160]])
      expect(
        resolveSpritePresentation(manifest, reaction, sources, sequence),
      ).toEqual(result)
      expect(result.layout.standaloneScale).toBe(3)
      expect(result.layout).toEqual(
        resolveSpritePresentation(
          { ...manifest, reactionAlternatives: {} },
          reaction,
          sources,
        ).layout,
      )
      const baseSources = Object.entries(manifest.animations)
        .filter(
          ([animationId]) =>
            !["sit", "sit01", "sit02", "eat"].includes(animationId),
        )
        .map(([, animation]) => animation.sourceId)
      expect(
        resolveSpritePresentation(manifest, reaction, baseSources, sequence),
      ).toEqual(resolveSpritePresentation(manifest, reaction, baseSources, 0))
    },
  )

  it.each([
    ["axolotl-stockfish", "capture", ["run", "attack", "run"]],
    ["axolotl-stockfish", "check", ["sneak", "attack", "walk"]],
    ["hedgehog-stockfish", "capture", ["run", "attack", "run"]],
    ["hedgehog-stockfish", "check", ["sneak", "attack", "walk"]],
    ["deer-stockfish", "capture", ["dash", "attack02", "dash"]],
    ["deer-stockfish", "check", ["run", "alerted", "run"]],
    ["fox-stockfish", "capture", ["dash", "attack", "dash"]],
    ["fox-stockfish", "victory", ["howl"]],
    ["wolf-stockfish", "capture", ["dash", "attack", "dash"]],
    ["wolf-stockfish", "victory", ["howl"]],
    [
      "parrot-stockfish",
      "victory",
      ["takeoff", "soar", "fall", "land", "idle_caw"],
    ],
    [
      "falcon-stockfish",
      "victory",
      ["takeoff", "soar_call", "fall", "land", "idle_call"],
    ],
    ["crane-stockfish", "victory", ["display", "call"]],
    [
      "crow-stockfish",
      "victory",
      ["takeoff", "soar", "fall", "land", "idle_caw"],
    ],
    ["bat-stockfish", "check", ["fly_forward", "fly_idle", "land_upright"]],
    ["dragonfly-stockfish", "capture", ["run", "attack", "run"]],
  ] as const)(
    "%s retains a complete source-specific alternative and stable geometry",
    (id, family, expected) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const reaction: MatchParticipantReaction =
        family === "victory" ? { family } : { family, role: "attacker" }
      const alternative = resolveSpritePresentation(
        manifest,
        reaction,
        sources,
        1,
      )
      if (alternative.kind !== "sprite")
        throw new Error("Expected licensed sprite")
      expect(alternative.steps.map(({ animationId }) => animationId)).toEqual(
        expected,
      )
      expect(resolveSpritePresentation(manifest, reaction, sources, 1)).toEqual(
        alternative,
      )
      const period =
        1 +
        (manifest.reactionAlternatives?.[matchSpriteReactionSlot(reaction)]
          ?.length ?? 0)
      expect(
        resolveSpritePresentation(manifest, reaction, sources, period),
      ).toEqual(resolveSpritePresentation(manifest, reaction, sources, 0))
      expect(alternative.layout).toEqual(
        resolveSpritePresentation(
          { ...manifest, reactionAlternatives: {} },
          reaction,
          sources,
        ).layout,
      )
      expect(alternative.layout.standaloneScale).toBe(3)
      expect(
        alternative.steps.every(
          ({ animation }) => animation.frameDurationMilliseconds === 100,
        ),
      ).toBe(true)
    },
  )

  it.each(["parrot-stockfish", "falcon-stockfish", "crow-stockfish"] as const)(
    "%s rejects an incomplete soaring celebration",
    (id) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const withoutSoaring = Object.entries(manifest.animations)
        .filter(([animationId]) => !animationId.startsWith("soar"))
        .map(([, animation]) => animation.sourceId)
      const result = resolveSpritePresentation(
        manifest,
        { family: "victory" },
        withoutSoaring,
        1,
      )
      expect(
        result.kind === "sprite" &&
          result.steps.map(({ animationId }) => animationId),
      ).toEqual([
        "takeoff",
        "fly",
        "fall",
        "land",
        id === "falcon-stockfish" ? "idle_call" : "idle_caw",
      ])
      const withoutLanding = Object.entries(manifest.animations)
        .filter(([animationId]) => animationId !== "land")
        .map(([, animation]) => animation.sourceId)
      const grounded = resolveSpritePresentation(
        manifest,
        { family: "victory" },
        withoutLanding,
        1,
      )
      expect(
        grounded.kind === "sprite" &&
          grounded.steps.every(({ animationId }) =>
            animationId.startsWith("idle"),
          ),
      ).toBe(true)
    },
  )

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
    ["bunny-stockfish", ["run", "dash"], ["attack"]],
    ["dog-stockfish", ["walk", "run", "dash"], ["attack"]],
    ["cat-stockfish", ["walk", "run", "dash", "sneak"], ["attack"]],
    ["mouse-stockfish", ["run", "dash"], ["attack"]],
    ["frog-stockfish", ["hop"], ["attackforward"]],
    ["turtle-stockfish", ["walk", "run"], ["attack"]],
    ["panda-stockfish", ["run"], ["attack01", "attack02", "bite"]],
    ["otter-stockfish", ["walk", "run", "dash", "sneak"], ["attack"]],
    ["axolotl-stockfish", ["walk", "run", "dash", "sneak"], ["attack"]],
    ["hedgehog-stockfish", ["walk", "run", "dash", "sneak"], ["attack"]],
    ["deer-stockfish", ["run", "dash"], ["attack01", "attack02"]],
    ["fox-stockfish", ["run", "dash"], ["attack"]],
    ["wolf-stockfish", ["run", "dash"], ["attack"]],
    ["crane-stockfish", ["walk", "run"], ["attack", "peck"]],
  ] as const)(
    "%s uses complete shared grounded capture recipes in the approved order",
    (id, locomotion, attacks) => {
      const manifest = STORY_ANIMAL_SPRITES[id]
      const sources = Object.values(manifest.animations).map(
        ({ sourceId }) => sourceId,
      )
      const reaction = { family: "capture", role: "attacker" } as const
      const period = Math.max(locomotion.length, attacks.length)
      for (let ordinal = 0; ordinal <= period; ordinal += 1) {
        const result = resolveSpritePresentation(
          manifest,
          reaction,
          sources,
          ordinal,
        )
        if (result.kind !== "sprite")
          throw new Error("Expected licensed sprite")
        const travel = locomotion[ordinal % locomotion.length]
        const attack = attacks[ordinal % attacks.length]
        expect(result.steps.map(({ animationId }) => animationId)).toEqual([
          travel,
          attack,
          travel,
        ])
        expect(result.steps.map(({ beat }) => beat)).toEqual([
          "approach",
          "strike",
          "recovery",
        ])
        expect(
          result.steps.every(
            ({ playback, animation }) =>
              playback === "once" &&
              animation.frameDurationMilliseconds === 100,
          ),
        ).toBe(true)
        expect(
          resolveSpritePresentation(manifest, reaction, sources, ordinal),
        ).toEqual(result)
        expect(result.layout.standaloneScale).toBe(3)
      }
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
      const withoutFirstTravel = Object.entries(manifest.animations)
        .filter(([id]) => id !== locomotion[0])
        .map(([, animation]) => animation.sourceId)
      const fallback = resolveSpritePresentation(
        manifest,
        reaction,
        withoutFirstTravel,
      )
      if (fallback.kind !== "sprite")
        throw new Error("Expected a complete fallback")
      expect(fallback.steps.map(({ animationId }) => animationId)).toEqual(
        locomotion.length === 1
          ? ["idle"]
          : [locomotion[1], attacks[1 % attacks.length], locomotion[1]],
      )
      const withoutAttacks = Object.entries(manifest.animations)
        .filter(([id]) => !attacks.some((attack) => attack === id))
        .map(([, animation]) => animation.sourceId)
      expect(
        resolveSpritePresentation(manifest, reaction, withoutAttacks),
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

  it("keeps Dragonfly ground and airborne captures complete across selection and source failure", () => {
    const manifest = STORY_ANIMAL_SPRITES["dragonfly-stockfish"]
    const reaction = { family: "capture", role: "attacker" } as const
    const sources = Object.values(manifest.animations).map(
      ({ sourceId }) => sourceId,
    )
    const recipes = [
      ["walk", "attack", "walk"],
      ["run", "attack", "run"],
      ["fly_forward", "attack", "land"],
      ["walk", "attack", "walk"],
    ]
    for (const [ordinal, expected] of recipes.entries()) {
      const result = resolveSpritePresentation(
        manifest,
        reaction,
        sources,
        ordinal,
      )
      if (result.kind !== "sprite") throw new Error("Expected licensed sprite")
      expect(result.steps.map(({ animationId }) => animationId)).toEqual(
        expected,
      )
      expect(result.steps.map(({ beat }) => beat)).toEqual([
        "approach",
        "strike",
        "recovery",
      ])
      expect(
        result.steps.every(
          ({ playback, animation }) =>
            playback === "once" && animation.frameDurationMilliseconds === 100,
        ),
      ).toBe(true)
      expect(
        resolveSpritePresentation(manifest, reaction, sources, ordinal),
      ).toEqual(result)
    }
    for (const missing of ["fly_forward", "land"] as const) {
      expect(
        resolveSpritePresentation(
          manifest,
          reaction,
          Object.entries(manifest.animations)
            .filter(([id]) => id !== missing)
            .map(([, animation]) => animation.sourceId),
          2,
        ),
      ).toEqual(resolveSpritePresentation(manifest, reaction, sources, 0))
    }
    const withoutGroundTravel = Object.entries(manifest.animations)
      .filter(([id]) => id !== "walk" && id !== "run")
      .map(([, animation]) => animation.sourceId)
    expect(
      resolveSpritePresentation(manifest, reaction, withoutGroundTravel, 0),
    ).toEqual(resolveSpritePresentation(manifest, reaction, sources, 2))
    expect(
      resolveSpritePresentation(
        manifest,
        reaction,
        Object.entries(manifest.animations)
          .filter(([id]) => id !== "attack")
          .map(([, animation]) => animation.sourceId),
        2,
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
  })

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

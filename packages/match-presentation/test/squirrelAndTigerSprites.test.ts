import { describe, expect, it } from "vitest"
import resolveSpritePresentation, {
  resolveSpriteAttention,
} from "../src/presentationAssetManifest"
import sprites from "../src/squirrelAndTigerSprites"

describe("Squirrel and Tiger performance", () => {
  it.each([
    [
      "squirrel-stockfish",
      2,
      4,
      ["idle_blink"],
      ["idle"],
      ["run", "attack", "run"],
      "idle_blink",
      ["wallgrab", "wallclimb"],
    ],
    [
      "tiger-stockfish",
      3,
      7,
      ["crouch", "roar"],
      ["idle", "idle_blink", "sit"],
      ["roar"],
      "fright",
      ["wallgrab"],
    ],
  ] as const)(
    "coordinates %s with the other participant at the authored contact frame",
    (id, contact, frameCount, attentions, rests, check, alarm, walls) => {
      const manifest = sprites[id]
      const sources = Object.values(manifest.animations).map((a) => a.sourceId)
      for (const [ordinal, locomotion] of ["run", "dash", "run"].entries()) {
        const attack = resolveSpritePresentation(
          manifest,
          { family: "capture", role: "attacker" },
          sources,
          ordinal,
        )
        if (attack.kind !== "sprite") throw Error("Expected licensed capture")
        expect(
          attack.steps.map((s) => [s.beat, s.animationId, s.frames]),
        ).toEqual([
          ["approach", locomotion, undefined],
          ["strike", "attack", [0, contact]],
          ["reaction", "attack", [contact, frameCount]],
          ["recovery", locomotion, undefined],
        ])
        expect(attack.steps[1]?.animation).toBe(attack.steps[2]?.animation)
        const rest = resolveSpritePresentation(
          manifest,
          { family: "idle" },
          sources,
          ordinal,
        )
        expect(rest.kind === "sprite" && rest.steps[0].animationId).toBe(
          rests[ordinal % rests.length],
        )
        expect(
          resolveSpriteAttention(manifest, sources, ordinal)?.animationId,
        ).toBe(attentions[ordinal % attentions.length])
      }
      for (const [reaction, ids] of [
        [{ family: "check", role: "attacker" }, check],
        [{ family: "check", role: "victim" }, [alarm]],
        [{ family: "capture", role: "victim" }, ["hurt"]],
        [{ family: "defeat" }, ["die"]],
      ] as const) {
        const p = resolveSpritePresentation(manifest, reaction, sources)
        if (p.kind !== "sprite") throw Error("Expected licensed reaction")
        expect(p.steps.map((s) => s.animationId)).toEqual(ids)
        if (reaction.family === "defeat")
          expect(p.steps[0].playback).toBe("once-hold-final-frame")
      }
      const jumps = ["jump", "fall", "land", "idle"]
      for (const ordinal of [0, 1]) {
        const win = resolveSpritePresentation(
          manifest,
          { family: "victory" },
          sources,
          ordinal,
        )
        if (win.kind !== "sprite") throw Error("Expected licensed victory")
        expect(win.steps.map((s) => s.animationId)).toEqual(
          id === "tiger-stockfish" && ordinal === 0 ? ["roar", "idle"] : jumps,
        )
        expect(win.repeatSequence).toBe(true)
        expect(win.steps.at(-1)?.animation.frameDurationMilliseconds).toBe(160)
      }
      const used = new Set(
        [
          ...Object.values(manifest.reactionPlans),
          ...Object.values(manifest.reactionAlternatives ?? {}).flat(),
        ].flatMap((plan) => plan.flatMap((s) => s.animationIds)),
      )
      for (const attention of attentions) used.add(attention)
      expect(
        Object.keys(manifest.animations)
          .filter((id) => !used.has(id))
          .sort(),
      ).toEqual([...walls].sort())
    },
  )
})

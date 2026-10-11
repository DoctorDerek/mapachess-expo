import { describe, expect, it } from "vitest"
import { MOVE_GRADES } from "@mapachess/match/move-feedback"
import resolveCoachPortrait, {
  COACH_COLLECTIONS,
  COACH_PORTRAIT_NAMES,
  COACH_PORTRAITS,
  coachPortraitFrame,
  DEFAULT_COACH_COLLECTION,
  type CoachPortraitLabel,
} from "../src/coachPortrait.js"
import type { MatchParticipantReaction } from "../src/matchReaction.js"

const BATTLE_REACTIONS = [
  { family: "idle" },
  { family: "capture", role: "attacker" },
  { family: "capture", role: "victim" },
  { family: "check", role: "attacker" },
  { family: "check", role: "victim" },
  { family: "victory" },
  { family: "defeat" },
] as const satisfies readonly MatchParticipantReaction[]

describe("complete coach expression collections", () => {
  it("keeps Mapachito default and canonical readable names separate from stable IDs", () => {
    expect(DEFAULT_COACH_COLLECTION).toBe("mapachito")
    expect(COACH_PORTRAIT_NAMES.happy_high).toBe("More Happy")
    expect(COACH_PORTRAIT_NAMES.hurt_low).toBe("Tiny Hurt")
    expect(COACH_PORTRAIT_NAMES.neutral).toBe("Normal / OK")
    expect(COACH_COLLECTIONS.mapachito.portraits).toHaveLength(16)
    expect(COACH_COLLECTIONS.greyfox.portraits).toEqual(
      COACH_COLLECTIONS.mapachito.portraits,
    )
  })

  it.each(["mapachito", "greyfox"] as const)(
    "reaches every authored expression in %s through real reaction families",
    (collection) => {
      const available = COACH_COLLECTIONS[collection].portraits
      const reached = new Set<CoachPortraitLabel>()
      for (const reaction of BATTLE_REACTIONS)
        for (let ordinal = 0; ordinal < 3; ordinal += 1)
          reached.add(resolveCoachPortrait(reaction, available, ordinal).label)
      for (const grade of MOVE_GRADES)
        for (const role of ["player", "opponent"] as const)
          reached.add(
            resolveCoachPortrait({ family: "move", grade, role }, available)
              .label,
          )
      expect([...reached].sort()).toEqual([...available].sort())
    },
  )

  it("uses the dedicated Tiny Hurt expression for GreyFox's player-relative reactions", () => {
    expect(
      resolveCoachPortrait(
        { family: "move", grade: "brilliant", role: "player" },
        COACH_COLLECTIONS.greyfox.portraits,
      ).label,
    ).toBe("brilliance")
    expect(
      resolveCoachPortrait(
        { family: "move", grade: "brilliant", role: "opponent" },
        COACH_COLLECTIONS.greyfox.portraits,
      ).label,
    ).toBe("hurt_high")
    expect(
      resolveCoachPortrait(
        { family: "move", grade: "inaccuracy", role: "player" },
        COACH_COLLECTIONS.mapachito.portraits,
      ).label,
    ).toBe("hurt_low")
    expect(
      resolveCoachPortrait(
        { family: "move", grade: "inaccuracy", role: "player" },
        COACH_COLLECTIONS.greyfox.portraits,
      ),
    ).toEqual({ kind: "portrait", label: "hurt_low" })
    expect(
      resolveCoachPortrait(
        { family: "move", grade: "best", role: "opponent" },
        COACH_COLLECTIONS.greyfox.portraits,
      ),
    ).toEqual({ kind: "portrait", label: "hurt_low" })
    expect(
      resolveCoachPortrait(
        { family: "capture", role: "victim" },
        COACH_COLLECTIONS.greyfox.portraits,
        1,
      ),
    ).toEqual({ kind: "portrait", label: "hurt_low" })
    expect(coachPortraitFrame("greyfox", "hurt_low")).toEqual({
      x: 37.5,
      y: 27,
      size: 95,
      sourceSize: 144,
    })
  })

  it("still falls back safely when the requested expression is genuinely unavailable", () => {
    const reaction = {
      family: "move",
      grade: "inaccuracy",
      role: "player",
    } as const
    expect(resolveCoachPortrait(reaction, ["neutral"])).toEqual({
      kind: "portrait",
      label: "neutral",
    })
    expect(resolveCoachPortrait(reaction, [])).toEqual({
      kind: "authored-fallback",
      label: "neutral",
    })
  })

  it("selects deterministic variants without replacing missing expressions with unrelated faces", () => {
    const portraits = COACH_PORTRAITS.map(({ label }) => label)
    expect(
      resolveCoachPortrait({ family: "victory" }, portraits, 0).label,
    ).toBe("satisfied_high")
    expect(
      resolveCoachPortrait({ family: "victory" }, portraits, 1).label,
    ).toBe("happy_high")
    expect(
      resolveCoachPortrait({ family: "victory" }, portraits, 2).label,
    ).toBe("satisfied_high")
    expect(resolveCoachPortrait({ family: "defeat" }, ["happy_high"])).toEqual({
      kind: "authored-fallback",
      label: "neutral",
    })
    expect(() =>
      resolveCoachPortrait({ family: "victory" }, portraits, -1),
    ).toThrow("variation ordinal")
  })
})

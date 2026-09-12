import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
  webChallengeDifficultyTargets,
} from "./webOpponentPolicy"

describe("versioned web opponent policies", () => {
  it.each(["standard", "chess960"] as const)(
    "separates %s animal identity from every supported Challenge preset",
    async (variant) => {
      expect(webChallengeDifficultyTargets(variant)).toEqual([
        100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
      ])
      for (const target of webChallengeDifficultyTargets(variant)) {
        const chicken = await resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          target,
        )
        const raccoon = await resolveWebChallengePolicy(
          "raccoon-stockfish",
          variant,
          target,
        )
        expect(raccoon).toEqual({ ...chicken, opponentId: "raccoon-stockfish" })
        expect(raccoon.targetElo).toBe(target)
        expect(
          await resolveWebChallengePolicy(
            "raccoon-stockfish",
            variant,
            undefined,
            raccoon.fingerprint,
          ),
        ).toEqual(raccoon)
      }
      const currentDefault = await resolveWebChallengePolicy(
        "chicken-stockfish",
        variant,
      )
      expect(currentDefault.targetElo).toBe(100)
      expect(
        await resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          undefined,
          "obsolete-policy",
        ),
      ).toEqual(currentDefault)
      expect(
        await resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          1000,
          currentDefault.fingerprint,
        ),
      ).toEqual(
        await resolveWebChallengePolicy("chicken-stockfish", variant, 1000),
      )
      expect(currentDefault.fingerprint).not.toBe(
        (
          await resolveWebChallengePolicy(
            "chicken-stockfish",
            variant === "standard" ? "chess960" : "standard",
          )
        ).fingerprint,
      )
      await expect(
        resolveWebChallengePolicy("chicken-stockfish", variant, 1100),
      ).rejects.toThrow("no supported web preset")
    },
  )
  it.each(["standard", "chess960"] as const)(
    "preserves the measured %s ladder through Raccoon",
    async (variant) => {
      const policies = await Promise.all(
        STOCKFISH_OPPONENTS.slice(0, 10).map(({ id }) =>
          resolveWebOpponentPolicy(id, variant),
        ),
      )
      expect(
        policies.map(
          ({ randomMoveProbabilityBasisPoints }) =>
            randomMoveProbabilityBasisPoints,
        ),
      ).toEqual(
        variant === "standard"
          ? [9000, 8000, 7350, 6550, 6150, 5500, 5000, 4450, 3850, 3650]
          : [8350, 8000, 7350, 6550, 6150, 5500, 5400, 5000, 4450, 3650],
      )
      expect(policies.at(-1)?.opponentId).toBe("raccoon-stockfish")
      expect(new Set(policies.map(({ fingerprint }) => fingerprint)).size).toBe(
        10,
      )
      for (const policy of policies) {
        const otherVariantPolicy = await resolveWebOpponentPolicy(
          policy.opponentId,
          variant === "standard" ? "chess960" : "standard",
        )
        expect(
          otherVariantPolicy.randomMoveProbabilityBasisPoints ===
            policy.randomMoveProbabilityBasisPoints,
        ).toBe(![100, 700, 800, 900].includes(policy.targetElo))
        expect(policy.nodeLimit).toBe(10_000)
        expect(policy.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(Object.isFrozen(policy)).toBe(true)
        expect(
          await resolveWebOpponentPolicy(policy.opponentId, variant),
        ).toEqual(policy)
        expect(otherVariantPolicy.fingerprint).not.toBe(policy.fingerprint)
        expect(
          (
            await resolveWebChallengePolicy(
              policy.opponentId,
              variant,
              policy.targetElo,
            )
          ).randomMoveProbabilityBasisPoints,
        ).toBe(policy.randomMoveProbabilityBasisPoints)
      }
      await expect(
        resolveWebOpponentPolicy("axolotl-stockfish", variant),
      ).rejects.toThrow("no measured web policy")
    },
  )
})

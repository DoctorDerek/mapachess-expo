import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import resolveWebOpponentPolicy, {
  legacyChickenWebPolicy,
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
        await expect(
          resolveWebChallengePolicy(
            "raccoon-stockfish",
            variant,
            target === 100 ? 1000 : 100,
            raccoon.fingerprint,
          ),
        ).rejects.toThrow("Saved opponent policy")
        await expect(
          resolveWebChallengePolicy(
            "raccoon-stockfish",
            variant === "standard" ? "chess960" : "standard",
            undefined,
            raccoon.fingerprint,
          ),
        ).rejects.toThrow("Saved opponent policy")
      }
      const previous = await resolveWebOpponentPolicy(
        "chicken-stockfish",
        variant,
      )
      expect(
        await resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          undefined,
          previous.fingerprint,
        ),
      ).toEqual(previous)
      const legacy = legacyChickenWebPolicy(variant)
      expect(
        await resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          undefined,
          legacy.fingerprint,
        ),
      ).toEqual(legacy)
      expect(legacy.targetElo).toBeNull()
      await expect(
        resolveWebChallengePolicy("chicken-stockfish", variant, 1100),
      ).rejects.toThrow("no supported web preset")
      await expect(
        resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          undefined,
          "unknown",
        ),
      ).rejects.toThrow("Saved opponent policy")
    },
  )
  it.each([
    ["standard", [9150, 8200, 7350, 6550, 6150, 5800, 5400, 5050, 4450, 3850]],
    ["chess960", [9300, 8700, 8100, 7400, 6650, 6000, 5350, 4800, 4300, 3800]],
  ] as const)(
    "preserves the measured %s ladder through Raccoon",
    async (variant, probabilities) => {
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
      ).toEqual(probabilities)
      expect(policies.at(-1)?.opponentId).toBe("raccoon-stockfish")
      expect(new Set(policies.map(({ fingerprint }) => fingerprint)).size).toBe(
        10,
      )
      for (const policy of policies) {
        expect(policy.nodeLimit).toBe(10_000)
        expect(policy.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(Object.isFrozen(policy)).toBe(true)
        expect(
          await resolveWebOpponentPolicy(
            policy.opponentId,
            variant,
            policy.fingerprint,
          ),
        ).toEqual(policy)
        await expect(
          resolveWebOpponentPolicy(
            policy.opponentId,
            variant === "standard" ? "chess960" : "standard",
            policy.fingerprint,
          ),
        ).rejects.toThrow("Saved opponent policy")
      }
      await expect(
        resolveWebOpponentPolicy("axolotl-stockfish", variant),
      ).rejects.toThrow("no measured web policy")
    },
  )

  it.each(["standard", "chess960"] as const)(
    "keeps the exact legacy %s Chicken fingerprint and behavior",
    async (variant) => {
      const legacy = legacyChickenWebPolicy(variant)
      expect(legacy.fingerprint).toBe(
        [
          `mapachess-${variant}-chicken-web-policy/v1`,
          "stockfish-js-source/31a98753a5d932511693f44775da908377c24513",
          "wasm-sha256/a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
          "nodes/10000",
          "random-basis-points/8000",
          "mapachess-web-sha256-position-state/v1",
        ].join("|"),
      )
      expect(
        await resolveWebOpponentPolicy(
          "chicken-stockfish",
          variant,
          legacy.fingerprint,
        ),
      ).toEqual(legacy)
      expect(legacy.randomMoveProbabilityBasisPoints).toBe(8000)
      expect(
        (await resolveWebOpponentPolicy("chicken-stockfish", variant))
          .fingerprint,
      ).not.toBe(legacy.fingerprint)
      await expect(
        resolveWebOpponentPolicy(
          "bunny-stockfish",
          variant,
          legacy.fingerprint,
        ),
      ).rejects.toThrow("Saved opponent policy")
      await expect(
        resolveWebOpponentPolicy(
          "chicken-stockfish",
          variant,
          `${legacy.fingerprint}/changed`,
        ),
      ).rejects.toThrow("Saved opponent policy")
    },
  )
})

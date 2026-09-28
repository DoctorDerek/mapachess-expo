import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import { WEB_CALIBRATED_LADDER } from "@mapachess/stockfish/web-opponent-policy"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
  webChallengeDifficultyTargets,
} from "./webOpponentPolicy"

describe("versioned web opponent policies", () => {
  it.each(["standard", "chess960"] as const)(
    "separates %s animal identity from every supported Challenge preset",
    async (variant) => {
      expect(webChallengeDifficultyTargets(variant)).toEqual(
        STOCKFISH_OPPONENTS.map(({ storyTargetElo }) => storyTargetElo),
      )
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
        resolveWebChallengePolicy("chicken-stockfish", variant, 2400),
      ).rejects.toThrow("no supported web preset")
    },
  )
  it.each(["standard", "chess960"] as const)(
    "uses the frozen %s calibration roster through Dragonfly",
    async (variant) => {
      const policies = await Promise.all(
        STOCKFISH_OPPONENTS.map(({ id }) =>
          resolveWebOpponentPolicy(id, variant),
        ),
      )
      expect(
        policies.map(
          ({ randomMoveProbabilityBasisPoints }) =>
            randomMoveProbabilityBasisPoints,
        ),
      ).toEqual(
        WEB_CALIBRATED_LADDER[variant].map(
          ({ randomMoveProbabilityBasisPoints }) =>
            randomMoveProbabilityBasisPoints,
        ),
      )
      expect(policies.at(-1)?.opponentId).toBe("dragonfly-stockfish")
      expect(new Set(policies.map(({ fingerprint }) => fingerprint)).size).toBe(
        STOCKFISH_OPPONENTS.length,
      )
      for (const policy of policies) {
        const otherVariantPolicy = await resolveWebOpponentPolicy(
          policy.opponentId,
          variant === "standard" ? "chess960" : "standard",
        )
        const measured =
          WEB_CALIBRATED_LADDER[variant][policy.targetElo / 100 - 1]
        expect(policy.calibrationFingerprint).toBe(
          measured?.calibrationFingerprint,
        )
        expect(policy.nodeLimit).toBe(10_000)
        expect(policy.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(policy.fingerprint).not.toBe(policy.calibrationFingerprint)
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
          ).fingerprint,
        ).toBe(policy.fingerprint)
      }
    },
  )

  it("resumes a prior Standard Story match without silently changing its opponent", async () => {
    const savedFingerprint =
      "sha256:c93b5f52dea763b3a0406c0bbf2b01e1ad4f816af037a5670934740988a4845b"
    const fresh = await resolveWebOpponentPolicy(
      "chicken-stockfish",
      "standard",
    )
    const resumed = await resolveWebOpponentPolicy(
      "chicken-stockfish",
      "standard",
      globalThis.crypto.subtle,
      savedFingerprint,
    )
    expect(fresh.randomMoveProbabilityBasisPoints).toBe(8_425)
    expect(resumed).toMatchObject({
      fingerprint: savedFingerprint,
      randomMoveProbabilityBasisPoints: 9_000,
      targetElo: 100,
    })
    expect(resumed.calibrationFingerprint).toBeUndefined()
  })

  it.each([
    [
      "standard",
      1000,
      "sha256:4f68664c63012a083d689189df672468815ca71148856b593f4bae3c700e819c",
      3650,
    ],
    [
      "chess960",
      700,
      "sha256:45ec70097d7819434a0e8d617bffb84fff2b6cf698490ac15958071182f0b583",
      5400,
    ],
  ] as const)(
    "resumes a prior %s Challenge match at %i without changing its policy",
    async (variant, targetElo, savedFingerprint, legacyProbability) => {
      const resumed = await resolveWebChallengePolicy(
        "raccoon-stockfish",
        variant,
        undefined,
        savedFingerprint,
      )
      expect(resumed).toMatchObject({
        fingerprint: savedFingerprint,
        randomMoveProbabilityBasisPoints: legacyProbability,
        targetElo,
      })
      expect(resumed.calibrationFingerprint).toBeUndefined()
      expect(
        (
          await resolveWebChallengePolicy(
            "raccoon-stockfish",
            variant,
            targetElo,
          )
        ).fingerprint,
      ).not.toBe(savedFingerprint)
    },
  )
})

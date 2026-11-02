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
      expect(webChallengeDifficultyTargets(variant)).toEqual(
        Array.from({ length: 91 }, (_, index) => 100 + 25 * index),
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
            target,
            raccoon.fingerprint,
          ),
        ).toEqual(raccoon)
      }
      const currentDefault = await resolveWebChallengePolicy(
        "chicken-stockfish",
        variant,
      )
      expect(currentDefault.targetElo).toBe(100)
      await expect(
        resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          undefined,
          "obsolete-policy",
        ),
      ).rejects.toThrow("saved Challenge opponent policy")
      await expect(
        resolveWebChallengePolicy(
          "chicken-stockfish",
          variant,
          1000,
          currentDefault.fingerprint,
        ),
      ).rejects.toThrow("saved Challenge opponent policy")
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
    "starts 25 distinct rated %s Story opponents at their calibrated target",
    async (variant) => {
      const policies = await Promise.all(
        STOCKFISH_OPPONENTS.map(({ id }) =>
          resolveWebOpponentPolicy(id, variant),
        ),
      )
      expect(new Set(policies.map(({ fingerprint }) => fingerprint)).size).toBe(
        25,
      )
      for (const [index, policy] of policies.entries()) {
        expect(policy.targetElo).toBe(
          STOCKFISH_OPPONENTS[index]?.storyTargetElo,
        )
        expect(policy.calibrationFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(policy.nodeLimit).toBe(10_000)
        expect(
          await resolveWebChallengePolicy(
            policy.opponentId,
            variant,
            policy.targetElo,
          ),
        ).toEqual(policy)
        expect(
          await resolveWebOpponentPolicy(
            policy.opponentId,
            variant,
            globalThis.crypto.subtle,
            policy.fingerprint,
          ),
        ).toEqual(policy)
      }
    },
  )
  it.each([
    [
      "standard",
      "frog-stockfish",
      600,
      "sha256:b4078c1f2643aa522664928b6e9ed926bf4793e66916932d2489aa422a546f90",
      5650,
    ],
    [
      "chess960",
      "frog-stockfish",
      600,
      "sha256:f79e6b093668af343ebbfe4f3f6ebe6eb116e113b75126bde29ac2efb7aa0042",
      5625,
    ],
    [
      "chess960",
      "crow-stockfish",
      1900,
      "sha256:11e6d28be72adf24ca3110694871ca2a834682127d05631065cc1752e0bec166",
      810,
    ],
  ] as const)(
    "keeps an old %s %s match at its exact %i Elo policy",
    async (variant, id, targetElo, fingerprint, probability) => {
      expect(
        await resolveWebOpponentPolicy(
          id,
          variant,
          globalThis.crypto.subtle,
          fingerprint,
        ),
      ).toMatchObject({
        opponentId: id,
        targetElo,
        fingerprint,
        randomMoveProbabilityBasisPoints: probability,
        calibrationFingerprint: expect.stringMatching(/^sha256:/),
      })
      expect((await resolveWebOpponentPolicy(id, variant)).targetElo).not.toBe(
        targetElo,
      )
    },
  )

  it.each([
    [
      "chess960",
      "sha256:9f31bfcefacfabb555a83dd097b1ed19cdf7dd38bd845d555227089e56f3bb90",
      8700,
    ],
    [
      "standard",
      "sha256:77ee73c925c9837774e83434e2c123bfa03b4a9b0914a21e5a5ff7146443e9b9",
      8200,
    ],
  ] as const)(
    "restores a pre-independent %s Challenge save with its Story identity",
    async (variant, fingerprint, probability) => {
      const story = await resolveWebOpponentPolicy(
        "bunny-stockfish",
        variant,
        globalThis.crypto.subtle,
        fingerprint,
      )
      const challenge = await resolveWebChallengePolicy(
        "bunny-stockfish",
        variant,
        undefined,
        fingerprint,
      )
      expect(challenge).toEqual(story)
      expect(challenge).toMatchObject({
        fingerprint,
        targetElo: 200,
        randomMoveProbabilityBasisPoints: probability,
      })
      expect(challenge.calibrationFingerprint).toBeUndefined()
    },
  )

  it.each(["standard", "chess960"] as const)(
    "keeps the first %s Chicken policy available to saved matches",
    async (variant) => {
      const fingerprint = [
        `mapachess-${variant}-chicken-web-policy/v1`,
        "stockfish-js-source/31a98753a5d932511693f44775da908377c24513",
        "wasm-sha256/a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
        "nodes/10000",
        "random-basis-points/8000",
        "mapachess-web-sha256-position-state/v1",
      ].join("|")
      const chicken = await resolveWebChallengePolicy(
        "chicken-stockfish",
        variant,
        100,
        fingerprint,
      )
      expect(chicken.fingerprint).toBe(fingerprint)
      expect(chicken.randomMoveProbabilityBasisPoints).toBe(8000)
      expect(chicken.calibrationFingerprint).toBeUndefined()
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

import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"
import standardChickenCandidatePlan, {
  STANDARD_CHICKEN_ANCHOR,
  STANDARD_CHICKEN_DEFAULT_EVIDENCE_ROOT,
  STANDARD_CHICKEN_MAX_PLIES,
  STANDARD_CHICKEN_NODE_LIMIT,
  STANDARD_CHICKEN_OPENINGS,
  STANDARD_CHICKEN_PAIRS_PER_OPENING,
  STANDARD_CHICKEN_POLICY_CATALOG,
  STANDARD_CHICKEN_TARGET_ELO,
} from "./standardChickenCandidatePlan"

describe("Standard Chicken candidate plan", () => {
  it("pins the bounded connected sweep approved for first evidence", () => {
    expect(STANDARD_CHICKEN_TARGET_ELO).toBe(100)
    expect(STANDARD_CHICKEN_MAX_PLIES).toBe(500)
    expect(STANDARD_CHICKEN_DEFAULT_EVIDENCE_ROOT).toBe(
      ".calibration/standard-chicken-candidates-500-plies",
    )
    expect(STANDARD_CHICKEN_NODE_LIMIT).toBe(10_000)
    expect(STANDARD_CHICKEN_PAIRS_PER_OPENING).toBe(4)
    expect(STANDARD_CHICKEN_OPENINGS).toHaveLength(5)
    expect(STANDARD_CHICKEN_POLICY_CATALOG).toHaveLength(7)
    expect(standardChickenCandidatePlan.policies).toHaveLength(7)
    expect(standardChickenCandidatePlan.games).toHaveLength(240)
    expect(
      new Set(standardChickenCandidatePlan.games.map(({ pairId }) => pairId))
        .size,
    ).toBe(120)

    const gameCountByEdge = Map.groupBy(
      standardChickenCandidatePlan.games,
      ({ edgeId }) => edgeId,
    )
    expect(gameCountByEdge.size).toBe(6)
    expect([...gameCountByEdge.values()].map((games) => games.length)).toEqual([
      40, 40, 40, 40, 40, 40,
    ])
  })

  it("uses five distinct legal nonterminal Standard positions", () => {
    expect(new Set(STANDARD_CHICKEN_OPENINGS.map(({ fen }) => fen)).size).toBe(
      5,
    )

    for (const opening of STANDARD_CHICKEN_OPENINGS) {
      const chess = new Chess(opening.fen)
      expect(chess.isGameOver()).toBe(false)
      expect(chess.turn()).toBe("w")
    }
  })

  it("holds every strength-bearing condition constant except the tested controls", () => {
    const bridgeElos: number[] = []
    const randomProbabilities: number[] = []

    for (const record of STANDARD_CHICKEN_POLICY_CATALOG) {
      const { policy } = record
      expect(policy.search).toMatchObject({
        nodeLimit: 10_000,
        threads: 1,
        hashMegabytes: 16,
        multiPv: 1,
        ponder: false,
        tablebases: { kind: "disabled" },
      })
      expect(policy.openingBook).toEqual({ kind: "disabled" })
      expect(policy.moveSelection.kind).toBe("best-or-uniform-random-legal")

      if (record.kind === "bridge") {
        expect(policy.search.strength.kind).toBe("uci-elo")
        if (policy.search.strength.kind === "uci-elo") {
          bridgeElos.push(policy.search.strength.elo)
        }
        expect(record.randomMoveProbabilityBasisPoints).toBe(0)
      } else {
        expect(policy.search.strength).toEqual({ kind: "full-strength" })
        randomProbabilities.push(record.randomMoveProbabilityBasisPoints)
      }
    }

    expect(bridgeElos).toEqual([1320, 1600])
    expect(randomProbabilities).toEqual([5_000, 6_500, 8_000, 9_000, 10_000])
    expect(STANDARD_CHICKEN_ANCHOR).toEqual({
      elo: 1320,
      policyFingerprint: STANDARD_CHICKEN_POLICY_CATALOG[0].policyFingerprint,
    })
  })
})

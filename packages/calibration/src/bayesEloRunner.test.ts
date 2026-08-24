import { describe, expect, it } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import type { BayesEloPolicyAlias } from "./bayesEloInput"
import type { BayesEloBridgeOffset } from "./bayesEloRatingEvidence"
import { createBayesEloCommands } from "./bayesEloRunner"

describe("BayesElo runner", () => {
  it("builds the bounded rating command session", () => {
    const policy = standardPlanFixture().policies[0]
    if (policy === undefined) {
      throw new Error("BayesElo command fixture policy is missing.")
    }
    const bridgeOffset: BayesEloBridgeOffset = {
      anchorElo: 1320,
      alias: "P001",
      policyFingerprint: policy.fingerprint,
    }

    expect(
      createBayesEloCommands(
        ["P001", "P002"] satisfies readonly BayesEloPolicyAlias[],
        bridgeOffset,
      ),
    ).toEqual([
      "readpgn input.pgn",
      "elo",
      "mm",
      "exactdist",
      "offset 1320 P001",
      "ratings",
      "los 0 2 5",
      "x",
      "x",
    ])
  })
})

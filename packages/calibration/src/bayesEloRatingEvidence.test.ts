import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import createBayesEloInput, {
  type BayesEloPolicyAliasRecord,
} from "./bayesEloInput"
import parseBayesEloRatingEvidence, {
  type BayesEloBridgeOffset,
} from "./bayesEloRatingEvidence"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"
import { STANDARD_CHICKEN_POLICY_CATALOG } from "./standardChickenCandidatePlan"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, {
        force: true,
        recursive: true,
      }),
    ),
  )
})

const unexpectedEngine = () => {
  throw new Error("A terminal fixture must not open Stockfish.")
}

async function completedInput() {
  const rootDirectory = await mkdtemp(
    join(tmpdir(), "mapachess-bayeselo-rating-evidence-"),
  )
  temporaryRoots.push(rootDirectory)
  const plan = standardPlanFixture()
  await executeCalibrationSmokeBatch({
    rootDirectory,
    plan,
    maxPlies: 10,
    maximumNewGames: plan.games.length,
    openEngine: unexpectedEngine,
  })
  return createBayesEloInput({ rootDirectory, plan, maxPlies: 10 })
}

function observedOutput(
  firstAlias: string,
  secondAlias: string,
  version = "0056",
): string {
  return `version ${version}, Copyright (C) 1997-2007 Remi Coulom.
ResultSet>ResultSet-EloRating>Rank Name   Elo    +    - games score oppo. draws
   1 ${firstAlias}  1320  100   90     2   50%  1320  100%
   2 ${secondAlias} 1320   90  100     2   50%  1320  100%
ResultSet-EloRating>      ${firstAlias} ${secondAlias}
${firstAlias}      5000
${secondAlias} 4999
ResultSet-EloRating>ResultSet>`
}

function observedStderr(ignoredGames = 0): string {
  return `2 game(s) loaded, ${ignoredGames} game(s) with unknown result ignored.\r\n`
}

function chickenPolicyAliases(): readonly BayesEloPolicyAliasRecord[] {
  return STANDARD_CHICKEN_POLICY_CATALOG.toSorted((left, right) =>
    left.policyFingerprint.localeCompare(right.policyFingerprint),
  ).map(({ policyFingerprint }, index) => ({
    alias: `P${String(index + 1).padStart(3, "0")}`,
    policyFingerprint,
  }))
}

function saturatedLikelihoodOutput(): string {
  return `version 0056, Copyright (C) 1997-2007 Remi Coulom.
ResultSet>ResultSet-EloRating>Rank Name   Elo    +    - games score oppo. draws
   1 P003  1750  168  114    40   94%  1320    3%
   2 P004  1320   96   97    80   50%  1311    3%
   3 P002   873   89   86    80   48%   923    6%
   4 P007   526   81   81    80   51%   509   10%
   5 P001   145   61   62    80   38%   287   33%
   6 P006    49   59   58    70   55%     4   44%
   7 P005  -184   92  109    30   15%    49   30%
ResultSet-EloRating>      P003 P004 P002 P007 P001 P006 P005
P003       9999 999910000100001000010000
P004     0      9999 9999100001000010000
P002     0    0      9999 9999 999910000
P007     0    0    0      9999 9999 9999
P001     0    0    0    0      9877 9999
P006     0    0    0    0  122      9999
P005     0    0    0    0    0    0${"     "}
ResultSet-EloRating>ResultSet>`
}

describe("BayesElo rating evidence", () => {
  it("parses observed ratings, asymmetric intervals, and likelihoods", async () => {
    const input = await completedInput()
    const first = input.policyAliases[0]
    const second = input.policyAliases[1]
    if (first === undefined || second === undefined) {
      throw new Error("BayesElo rating fixture aliases are missing.")
    }
    const bridgeOffset: BayesEloBridgeOffset = {
      anchorElo: 1320,
      alias: first.alias,
      policyFingerprint: first.policyFingerprint,
    }

    const evidence = parseBayesEloRatingEvidence({
      input,
      bridgeOffset,
      stdout: observedOutput(first.alias, second.alias),
      stderr: observedStderr(),
    })

    expect(evidence).toMatchObject({
      bridgeOffset,
      observedVersion: "0056",
      completedGameCount: 2,
      ratings: [
        {
          alias: first.alias,
          policyFingerprint: first.policyFingerprint,
          estimateElo: 1320,
          confidence95: { lowerElo: 1230, upperElo: 1420 },
          games: 2,
          scorePercent: 50,
          drawPercent: 100,
        },
        {
          alias: second.alias,
          policyFingerprint: second.policyFingerprint,
          estimateElo: 1320,
          confidence95: { lowerElo: 1220, upperElo: 1410 },
        },
      ],
    })
    expect(evidence.likelihoodOfSuperiority).toEqual([
      {
        policyAlias: first.alias,
        policyFingerprint: first.policyFingerprint,
        opponentAlias: second.alias,
        opponentPolicyFingerprint: second.policyFingerprint,
        probabilityBasisPoints: 5000,
      },
      {
        policyAlias: second.alias,
        policyFingerprint: second.policyFingerprint,
        opponentAlias: first.alias,
        opponentPolicyFingerprint: first.policyFingerprint,
        probabilityBasisPoints: 4999,
      },
    ])
    expect(evidence.transcript.stdoutSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects the wrong executable version or ignored PGN result", async () => {
    const input = await completedInput()
    const first = input.policyAliases[0]
    const second = input.policyAliases[1]
    if (first === undefined || second === undefined) {
      throw new Error("BayesElo rating fixture aliases are missing.")
    }
    const bridgeOffset: BayesEloBridgeOffset = {
      anchorElo: 1320,
      alias: first.alias,
      policyFingerprint: first.policyFingerprint,
    }

    expect(() =>
      parseBayesEloRatingEvidence({
        input,
        bridgeOffset,
        stdout: observedOutput(first.alias, second.alias, "0057"),
        stderr: observedStderr(),
      }),
    ).toThrow("BayesElo version mismatch")
    expect(() =>
      parseBayesEloRatingEvidence({
        input,
        bridgeOffset,
        stdout: observedOutput(first.alias, second.alias),
        stderr: observedStderr(1),
      }),
    ).toThrow("expected 2 loaded and 0 ignored")
  })

  it("rejects rating output that omits a planned policy alias", async () => {
    const input = await completedInput()
    const first = input.policyAliases[0]
    const second = input.policyAliases[1]
    const thirdPolicy = STANDARD_CHICKEN_POLICY_CATALOG[2]
    if (first === undefined || second === undefined) {
      throw new Error("BayesElo rating fixture aliases are missing.")
    }
    const bridgeOffset: BayesEloBridgeOffset = {
      anchorElo: 1320,
      alias: first.alias,
      policyFingerprint: first.policyFingerprint,
    }

    expect(() =>
      parseBayesEloRatingEvidence({
        input: {
          ...input,
          policyAliases: [first, { ...second, alias: first.alias }],
        },
        bridgeOffset,
        stdout: observedOutput(first.alias, second.alias),
        stderr: observedStderr(),
      }),
    ).toThrow("BayesElo input contains duplicate policy aliases.")

    expect(() =>
      parseBayesEloRatingEvidence({
        input: {
          ...input,
          policyAliases: [
            ...input.policyAliases,
            {
              alias: "P003",
              policyFingerprint: thirdPolicy.policyFingerprint,
            },
          ],
        },
        bridgeOffset,
        stdout: observedOutput(first.alias, second.alias),
        stderr: observedStderr(),
      }),
    ).toThrow("BayesElo ratings do not cover every policy alias.")
  })

  it("parses saturated fixed-width likelihood columns", async () => {
    const input = await completedInput()
    const policyAliases = chickenPolicyAliases()
    const anchorPolicy = STANDARD_CHICKEN_POLICY_CATALOG.find(
      ({ id }) => id === "uci-elo-1320",
    )
    const anchorAlias = policyAliases.find(
      ({ policyFingerprint }) =>
        policyFingerprint === anchorPolicy?.policyFingerprint,
    )
    if (anchorPolicy === undefined || anchorAlias === undefined) {
      throw new Error("Standard Chicken anchor fixture is missing.")
    }

    const evidence = parseBayesEloRatingEvidence({
      input: {
        ...input,
        completedGameCount: 230,
        completedPairCount: 115,
        excludedPairCount: 5,
        policyAliases,
      },
      bridgeOffset: {
        anchorElo: 1320,
        alias: anchorAlias.alias,
        policyFingerprint: anchorPolicy.policyFingerprint,
      },
      stdout: saturatedLikelihoodOutput(),
      stderr: "230 game(s) loaded, 0 game(s) with unknown result ignored.\r\n",
    })

    expect(evidence.ratings).toHaveLength(7)
    expect(evidence.likelihoodOfSuperiority).toHaveLength(42)
    expect(evidence.likelihoodOfSuperiority).toContainEqual({
      policyAlias: "P003",
      policyFingerprint: STANDARD_CHICKEN_POLICY_CATALOG.find(
        ({ id }) => id === "uci-elo-1600",
      )?.policyFingerprint,
      opponentAlias: "P007",
      opponentPolicyFingerprint: STANDARD_CHICKEN_POLICY_CATALOG.find(
        ({ id }) => id === "random-06500",
      )?.policyFingerprint,
      probabilityBasisPoints: 10_000,
    })
    expect(evidence.likelihoodOfSuperiority).toContainEqual({
      policyAlias: "P006",
      policyFingerprint: STANDARD_CHICKEN_POLICY_CATALOG.find(
        ({ id }) => id === "random-09000",
      )?.policyFingerprint,
      opponentAlias: "P001",
      opponentPolicyFingerprint: STANDARD_CHICKEN_POLICY_CATALOG.find(
        ({ id }) => id === "random-08000",
      )?.policyFingerprint,
      probabilityBasisPoints: 122,
    })
  })
})

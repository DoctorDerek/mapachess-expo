import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import createBayesEloInput from "./bayesEloInput"
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
})

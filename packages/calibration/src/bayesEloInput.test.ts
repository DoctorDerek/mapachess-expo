import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  chess960PlanFixture,
  completedChess960EvidenceFixture,
  onePlyUnterminatedEvidenceFixture,
  standardPlanFixture,
} from "../test/calibrationFixtures"
import createBayesEloInput, {
  BAYES_ELO_INPUT_SCHEMA_VERSION,
} from "./bayesEloInput"
import persistCalibrationGameEvidence from "./calibrationEvidenceStore"
import createCalibrationGameEvidence from "./calibrationGameEvidence"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"

const temporaryRoots: string[] = []

async function temporaryEvidenceRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mapachess-bayeselo-input-"))
  temporaryRoots.push(root)
  return root
}

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

describe("BayesElo input", () => {
  it("exports only a both-completed pair with deterministic short aliases", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const plan = standardPlanFixture()
    const pair = plan.games[0]
    const firstPolicy = plan.policies[0]
    const secondPolicy = plan.policies[1]
    if (
      pair === undefined ||
      firstPolicy === undefined ||
      secondPolicy === undefined
    ) {
      throw new Error("BayesElo input fixture is incomplete.")
    }
    const batchInput = {
      rootDirectory,
      plan,
      maxPlies: 10,
      maximumNewGames: 1,
      openEngine: unexpectedEngine,
    }
    await executeCalibrationSmokeBatch(batchInput)

    const partial = await createBayesEloInput({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    expect(partial).toMatchObject({
      schemaVersion: BAYES_ELO_INPUT_SCHEMA_VERSION,
      scheduledPairCount: 1,
      completedPairCount: 0,
      completedGameCount: 0,
      excludedPairCount: 1,
      completedPairIds: [],
      pgn: "",
    })

    await executeCalibrationSmokeBatch(batchInput)
    const complete = await createBayesEloInput({
      rootDirectory,
      plan,
      maxPlies: 10,
    })
    const repeated = await createBayesEloInput({
      rootDirectory,
      plan,
      maxPlies: 10,
    })

    expect(complete).toEqual(repeated)
    expect(complete).toMatchObject({
      scheduledPairCount: 1,
      completedPairCount: 1,
      completedGameCount: 2,
      excludedPairCount: 0,
      completedPairIds: [pair.pairId],
      policyAliases: [
        { alias: "P001", policyFingerprint: firstPolicy.fingerprint },
        { alias: "P002", policyFingerprint: secondPolicy.fingerprint },
      ],
    })
    expect(complete.pgn.match(/\[White "P\d{3}"\]/g)).toHaveLength(2)
    expect(complete.pgn.match(/\[Black "P\d{3}"\]/g)).toHaveLength(2)
    expect(complete.pgn.match(/\[Result "1\/2-1\/2"\]/g)).toHaveLength(2)
    expect(complete.inputSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(complete.pgnSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it("excludes unterminated evidence from the rating input", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const { plan, evidence } = onePlyUnterminatedEvidenceFixture()
    await persistCalibrationGameEvidence({ rootDirectory, plan, evidence })

    await expect(
      createBayesEloInput({ rootDirectory, plan, maxPlies: 1 }),
    ).resolves.toMatchObject({
      scheduledPairCount: 1,
      completedPairCount: 0,
      excludedPairCount: 1,
      pgn: "",
    })
  })

  it("keeps Standard and Chess960 rating pools separate", async () => {
    const rootDirectory = await temporaryEvidenceRoot()
    const standardPlan = standardPlanFixture()
    const castlingFen = "4k1n1/8/8/8/8/8/8/R4KR1 w GA - 0 1"
    const chess960Plan = chess960PlanFixture(castlingFen)
    const fixture = completedChess960EvidenceFixture(castlingFen, [
      "f1g1",
      "g8f6",
      "g1h1",
      "f6g8",
      "h1g1",
      "g8f6",
      "g1h1",
      "f6g8",
      "h1g1",
    ])
    for (const game of chess960Plan.games) {
      const evidence = createCalibrationGameEvidence({
        plan: chess960Plan,
        maxPlies: 10,
        result: {
          ...fixture.result,
          gameId: game.gameId,
          pairId: game.pairId,
          moves: fixture.result.moves.map((move) => ({
            ...move,
            policyFingerprint: game[move.color].policyFingerprint,
          })),
        },
      })
      await persistCalibrationGameEvidence({
        rootDirectory,
        plan: chess960Plan,
        evidence,
      })
    }
    const standard = await createBayesEloInput({
      rootDirectory,
      plan: standardPlan,
      maxPlies: 10,
    })
    const chess960 = await createBayesEloInput({
      rootDirectory,
      plan: chess960Plan,
      maxPlies: 10,
    })
    expect(standard.completedGameCount).toBe(0)
    expect(chess960.completedGameCount).toBe(2)
    expect(chess960.variant).toBe("chess960")
    expect(chess960.inputSha256).not.toBe(standard.inputSha256)
    expect(chess960.pgn.match(/\[Variant "Chess960"\]/g)).toHaveLength(2)
    expect(chess960.pgn).toContain(`[FEN "${fixture.game.fen}"]`)
    expect(chess960.pgn.match(/\[White "P\d{3}"\]/g)).toHaveLength(2)
    expect(chess960.pgn).toContain("1. O-O Nf6 2. Kh1 Ng8")
    expect(
      await createBayesEloInput({
        rootDirectory,
        plan: chess960Plan,
        maxPlies: 10,
      }),
    ).toEqual(chess960)
  })
})

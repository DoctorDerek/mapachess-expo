import { describe, expect, it } from "vitest"
import { STOCKFISH_18_BUILD_IDENTITY } from "@mapachess/stockfish/build-identity"
import { STOCKFISH_PROCESS_ADAPTER_VERSION } from "@mapachess/stockfish/uci-process-adapter"
import createCalibrationGameEvidence, {
  CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION,
  serializeCalibrationGameEvidence,
} from "./calibrationGameEvidence"
import type { CalibrationGameResult } from "./calibrationGameTypes"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
} from "./calibrationPlan"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "./deterministicRandom"
import {
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  type OpponentPolicy,
} from "./opponentPolicy"

const STALEMATE_FEN = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"

function createPolicy(nodeLimit: number): OpponentPolicy {
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant: "standard",
    engine: STOCKFISH_18_BUILD_IDENTITY,
    search: {
      strength: { kind: "full-strength" },
      nodeLimit,
      threads: 1,
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
      commandProtocolVersion: CALIBRATION_COMMAND_PROTOCOL_VERSION,
      tablebases: { kind: "disabled" },
    },
    moveSelection: {
      kind: "best-or-uniform-random-legal",
      randomMoveProbabilityBasisPoints: 0,
      algorithmVersion: CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
      legalMoveGeneratorVersion: CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
    },
    randomness: {
      algorithmVersion: CALIBRATION_RANDOM_ALGORITHM_VERSION,
      seedDerivationVersion: CALIBRATION_SEED_DERIVATION_VERSION,
    },
    openingBook: { kind: "disabled" },
    runtime: {
      target: "windows-x64",
      adapterVersion: STOCKFISH_PROCESS_ADAPTER_VERSION,
    },
  }
}

function createFixture(seed = 42): Readonly<{
  plan: ReturnType<typeof createCalibrationPlan>
  result: CalibrationGameResult
}> {
  const plan = createCalibrationPlan({
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    seed,
    variant: "standard",
    openings: [{ id: "stalemate", fen: STALEMATE_FEN }],
    edges: [
      {
        id: "fixture-edge",
        pairsPerOpening: 1,
        policyA: createPolicy(1_000),
        policyB: createPolicy(2_000),
      },
    ],
  })
  const game = plan.games[0]
  if (game === undefined) throw new Error("Fixture game is missing.")

  return {
    plan,
    result: {
      status: "completed",
      gameId: game.gameId,
      pairId: game.pairId,
      finalFen: game.fen,
      moves: [],
      termination: { kind: "stalemate" },
    },
  }
}

describe("calibration game evidence", () => {
  it("captures the exact plan, policies, bound, and result", () => {
    const fixture = createFixture()
    const evidence = createCalibrationGameEvidence({
      ...fixture,
      maxPlies: 200,
    })

    expect(evidence).toMatchObject({
      schemaVersion: CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION,
      planId: fixture.plan.planId,
      planSeed: fixture.plan.seed,
      maxPlies: 200,
      result: fixture.result,
    })
    expect(evidence.policies.white.fingerprint).toBe(
      evidence.game.white.policyFingerprint,
    )
    expect(evidence.policies.black.fingerprint).toBe(
      evidence.game.black.policyFingerprint,
    )
    expect(JSON.parse(serializeCalibrationGameEvidence(evidence))).toEqual(
      evidence,
    )
    expect(serializeCalibrationGameEvidence(evidence)).toMatch(/\n$/)
  })

  it("rejects a result outside the scheduled plan", () => {
    const fixture = createFixture()
    const otherFixture = createFixture(43)

    expect(() =>
      createCalibrationGameEvidence({
        plan: fixture.plan,
        maxPlies: 200,
        result: {
          ...fixture.result,
          gameId: otherFixture.result.gameId,
        },
      }),
    ).toThrow("is not scheduled")
  })

  it("rejects a move attributed to the wrong seat policy", () => {
    const fixture = createFixture()
    const game = fixture.plan.games[0]
    if (game === undefined) throw new Error("Fixture game is missing.")

    expect(() =>
      createCalibrationGameEvidence({
        plan: fixture.plan,
        maxPlies: 200,
        result: {
          ...fixture.result,
          finalFen: "fixture-after",
          moves: [
            {
              ply: 1,
              color: "white",
              policyFingerprint: game.black.policyFingerprint,
              source: "stockfish",
              uci: "f7f8",
              fenBefore: game.fen,
              fenAfter: "fixture-after",
            },
          ],
        },
      }),
    ).toThrow("has the wrong white policy")
  })

  it("rejects an unterminated result that did not exhaust its bound", () => {
    const fixture = createFixture()

    expect(() =>
      createCalibrationGameEvidence({
        plan: fixture.plan,
        maxPlies: 200,
        result: {
          ...fixture.result,
          status: "unterminated",
          termination: "max-plies",
          maxPlies: 100,
        },
      }),
    ).toThrow("must exhaust its execution bound")
  })
})

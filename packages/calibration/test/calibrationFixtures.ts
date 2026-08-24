import { Chess } from "chess.js"
import { STOCKFISH_18_BUILD_IDENTITY } from "@mapachess/stockfish/build-identity"
import { STOCKFISH_PROCESS_ADAPTER_VERSION } from "@mapachess/stockfish/uci-process-adapter"
import createCalibrationGameEvidence from "../src/calibrationGameEvidence.js"
import type { CalibrationGameResult } from "../src/calibrationGameTypes.js"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
  type CalibrationPlan,
} from "../src/calibrationPlan.js"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "../src/deterministicRandom.js"
import {
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  type OpponentPolicy,
} from "../src/opponentPolicy.js"

export const STALEMATE_FEN = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"
export const MATE_IN_ONE_FEN = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"

export function standardPolicyFixture(nodeLimit: number): OpponentPolicy {
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

export function standardPlanFixture(
  fen = STALEMATE_FEN,
  seed = 42,
): CalibrationPlan {
  return createCalibrationPlan({
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    seed,
    variant: "standard",
    openings: [{ id: "fixture-opening", fen }],
    edges: [
      {
        id: "fixture-edge",
        pairsPerOpening: 1,
        policyA: standardPolicyFixture(1_000),
        policyB: standardPolicyFixture(2_000),
      },
    ],
  })
}

export function stalemateResultFixture(
  plan = standardPlanFixture(),
): CalibrationGameResult {
  const game = plan.games[0]
  if (game === undefined) throw new Error("Fixture game is missing.")

  return {
    status: "completed",
    gameId: game.gameId,
    pairId: game.pairId,
    finalFen: game.fen,
    moves: [],
    termination: { kind: "stalemate" },
  }
}

export function mateInOneEvidenceFixture() {
  const plan = standardPlanFixture(MATE_IN_ONE_FEN)
  const game = plan.games[0]
  if (game === undefined) throw new Error("Fixture game is missing.")
  const chess = new Chess(game.fen)
  const fenBefore = chess.fen()
  chess.move({ from: "g6", to: "g7" })
  const result: CalibrationGameResult = {
    status: "completed",
    gameId: game.gameId,
    pairId: game.pairId,
    finalFen: chess.fen(),
    moves: [
      {
        ply: 1,
        color: "white",
        policyFingerprint: game.white.policyFingerprint,
        source: "stockfish",
        uci: "g6g7",
        fenBefore,
        fenAfter: chess.fen(),
      },
    ],
    termination: { kind: "checkmate", winner: "white" },
  }

  return {
    plan,
    evidence: createCalibrationGameEvidence({ plan, maxPlies: 10, result }),
  }
}

export function onePlyUnterminatedEvidenceFixture() {
  const plan = standardPlanFixture(new Chess().fen())
  const game = plan.games[0]
  if (game === undefined) throw new Error("Fixture game is missing.")
  const chess = new Chess(game.fen)
  const fenBefore = chess.fen()
  chess.move({ from: "e2", to: "e4" })
  const result: CalibrationGameResult = {
    status: "unterminated",
    gameId: game.gameId,
    pairId: game.pairId,
    finalFen: chess.fen(),
    maxPlies: 1,
    moves: [
      {
        ply: 1,
        color: "white",
        policyFingerprint: game.white.policyFingerprint,
        source: "stockfish",
        uci: "e2e4",
        fenBefore,
        fenAfter: chess.fen(),
      },
    ],
    termination: "max-plies",
  }

  return {
    plan,
    evidence: createCalibrationGameEvidence({ plan, maxPlies: 1, result }),
  }
}

import {
  STOCKFISH_18_BUILD_IDENTITY,
  STOCKFISH_18_RUNTIME_TARGET,
} from "@mapachess/stockfish/build-identity"
import { STOCKFISH_PROCESS_ADAPTER_VERSION } from "@mapachess/stockfish/uci-process-adapter"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
} from "./calibrationPlan.js"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "./deterministicRandom.js"
import {
  CALIBRATION_CHESS960_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  type CalibrationVariant,
  type OpponentPolicy,
} from "./opponentPolicy.js"

const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

export function calibrationSmokePolicy(
  nodeLimit: number,
  variant: CalibrationVariant = "standard",
): OpponentPolicy {
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant,
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
      legalMoveGeneratorVersion:
        variant === "standard"
          ? CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION
          : CALIBRATION_CHESS960_LEGAL_MOVE_GENERATOR_VERSION,
    },
    randomness: {
      algorithmVersion: CALIBRATION_RANDOM_ALGORITHM_VERSION,
      seedDerivationVersion: CALIBRATION_SEED_DERIVATION_VERSION,
    },
    openingBook: { kind: "disabled" },
    runtime: {
      target: STOCKFISH_18_RUNTIME_TARGET,
      adapterVersion: STOCKFISH_PROCESS_ADAPTER_VERSION,
    },
  }
}

const standardCalibrationSmokePlan = createCalibrationPlan({
  schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
  seed: 42,
  variant: "standard",
  openings: [{ id: "standard-start", fen: STANDARD_START_FEN }],
  edges: [
    {
      id: "nodes-1000-vs-2000",
      pairsPerOpening: 1,
      policyA: calibrationSmokePolicy(1_000),
      policyB: calibrationSmokePolicy(2_000),
    },
  ],
})

export default standardCalibrationSmokePlan

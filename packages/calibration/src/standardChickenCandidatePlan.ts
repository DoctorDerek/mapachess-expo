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
import fingerprintOpponentPolicy, {
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  type OpponentPolicy,
  type OpponentPolicyFingerprint,
  type UciStrength,
} from "./opponentPolicy.js"

export const STANDARD_CHICKEN_TARGET_ELO = 100 as const
export const STANDARD_CHICKEN_MAX_PLIES = 500 as const
export const STANDARD_CHICKEN_DEFAULT_EVIDENCE_ROOT =
  `.calibration/standard-chicken-candidates-${STANDARD_CHICKEN_MAX_PLIES}-plies` as const
export const STANDARD_CHICKEN_NODE_LIMIT = 10_000 as const
export const STANDARD_CHICKEN_PAIRS_PER_OPENING = 4 as const

export type StandardChickenPolicyId =
  | "random-05000"
  | "random-06500"
  | "random-08000"
  | "random-09000"
  | "random-10000"
  | "uci-elo-1320"
  | "uci-elo-1600"

export type StandardChickenPolicyRecord = Readonly<{
  id: StandardChickenPolicyId
  kind: "bridge" | "random-candidate"
  policy: OpponentPolicy
  policyFingerprint: OpponentPolicyFingerprint
  randomMoveProbabilityBasisPoints: number
}>

function standardChickenPolicy(
  strength: UciStrength,
  randomMoveProbabilityBasisPoints: number,
): OpponentPolicy {
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant: "standard",
    engine: STOCKFISH_18_BUILD_IDENTITY,
    search: {
      strength,
      nodeLimit: STANDARD_CHICKEN_NODE_LIMIT,
      threads: 1,
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
      commandProtocolVersion: CALIBRATION_COMMAND_PROTOCOL_VERSION,
      tablebases: { kind: "disabled" },
    },
    moveSelection: {
      kind: "best-or-uniform-random-legal",
      randomMoveProbabilityBasisPoints,
      algorithmVersion: CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
      legalMoveGeneratorVersion: CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
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

function policyRecord(
  id: StandardChickenPolicyId,
  kind: StandardChickenPolicyRecord["kind"],
  policy: OpponentPolicy,
): StandardChickenPolicyRecord {
  return {
    id,
    kind,
    policy,
    policyFingerprint: fingerprintOpponentPolicy(policy),
    randomMoveProbabilityBasisPoints:
      policy.moveSelection.randomMoveProbabilityBasisPoints,
  }
}

const UCI_ELO_1320 = policyRecord(
  "uci-elo-1320",
  "bridge",
  standardChickenPolicy({ kind: "uci-elo", elo: 1320 }, 0),
)
const UCI_ELO_1600 = policyRecord(
  "uci-elo-1600",
  "bridge",
  standardChickenPolicy({ kind: "uci-elo", elo: 1600 }, 0),
)
const RANDOM_05000 = policyRecord(
  "random-05000",
  "random-candidate",
  standardChickenPolicy({ kind: "full-strength" }, 5_000),
)
const RANDOM_06500 = policyRecord(
  "random-06500",
  "random-candidate",
  standardChickenPolicy({ kind: "full-strength" }, 6_500),
)
const RANDOM_08000 = policyRecord(
  "random-08000",
  "random-candidate",
  standardChickenPolicy({ kind: "full-strength" }, 8_000),
)
const RANDOM_09000 = policyRecord(
  "random-09000",
  "random-candidate",
  standardChickenPolicy({ kind: "full-strength" }, 9_000),
)
const RANDOM_10000 = policyRecord(
  "random-10000",
  "random-candidate",
  standardChickenPolicy({ kind: "full-strength" }, 10_000),
)

export const STANDARD_CHICKEN_POLICY_CATALOG = [
  UCI_ELO_1320,
  UCI_ELO_1600,
  RANDOM_05000,
  RANDOM_06500,
  RANDOM_08000,
  RANDOM_09000,
  RANDOM_10000,
] as const satisfies readonly StandardChickenPolicyRecord[]

export const STANDARD_CHICKEN_ANCHOR = {
  elo: 1320,
  policyFingerprint: UCI_ELO_1320.policyFingerprint,
} as const

export const STANDARD_CHICKEN_OPENINGS = [
  {
    id: "standard-start",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  {
    id: "open-game-e4-e5",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  {
    id: "queen-pawn-d4-d5",
    fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
  },
  {
    id: "english-c4-e5",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2",
  },
  {
    id: "reti-nf3-d5",
    fen: "rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2",
  },
] as const

const standardChickenCandidatePlan = createCalibrationPlan({
  schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
  seed: 42,
  variant: "standard",
  openings: STANDARD_CHICKEN_OPENINGS,
  edges: [
    {
      id: "uci-1320-vs-uci-1600",
      pairsPerOpening: STANDARD_CHICKEN_PAIRS_PER_OPENING,
      policyA: UCI_ELO_1320.policy,
      policyB: UCI_ELO_1600.policy,
    },
    {
      id: "uci-1320-vs-random-05000",
      pairsPerOpening: STANDARD_CHICKEN_PAIRS_PER_OPENING,
      policyA: UCI_ELO_1320.policy,
      policyB: RANDOM_05000.policy,
    },
    {
      id: "random-05000-vs-random-06500",
      pairsPerOpening: STANDARD_CHICKEN_PAIRS_PER_OPENING,
      policyA: RANDOM_05000.policy,
      policyB: RANDOM_06500.policy,
    },
    {
      id: "random-06500-vs-random-08000",
      pairsPerOpening: STANDARD_CHICKEN_PAIRS_PER_OPENING,
      policyA: RANDOM_06500.policy,
      policyB: RANDOM_08000.policy,
    },
    {
      id: "random-08000-vs-random-09000",
      pairsPerOpening: STANDARD_CHICKEN_PAIRS_PER_OPENING,
      policyA: RANDOM_08000.policy,
      policyB: RANDOM_09000.policy,
    },
    {
      id: "random-09000-vs-random-10000",
      pairsPerOpening: STANDARD_CHICKEN_PAIRS_PER_OPENING,
      policyA: RANDOM_09000.policy,
      policyB: RANDOM_10000.policy,
    },
  ],
})

export default standardChickenCandidatePlan

import {
  CHESS960_POSITION_COUNT,
  createChess960InitialFen,
  parseChess960PositionId,
} from "@mapachess/match/chess960-position"
import {
  STOCKFISH_18_BUILD_IDENTITY,
  STOCKFISH_18_RUNTIME_TARGET,
} from "@mapachess/stockfish/build-identity"
import { OPPONENT_POSITION_SEED_DERIVATION_VERSION } from "@mapachess/stockfish/opponent-move-selection"
import { STOCKFISH_PROCESS_ADAPTER_VERSION } from "@mapachess/stockfish/uci-process-adapter"
import type { RunBayesEloInput } from "./bayesEloRunner.js"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
  type CalibrationOpening,
  type CalibrationPlan,
} from "./calibrationPlan.js"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  deriveCalibrationSeed,
  parseCalibrationRootSeed,
  shuffleDeterministically,
} from "./deterministicRandom.js"
import fingerprintOpponentPolicy, {
  CALIBRATION_CANONICAL_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  WEB_CALIBRATION_ADAPTER_VERSION,
  WEB_CALIBRATION_ENGINE_IDENTITY,
  type CalibrationVariant,
  type OpponentPolicy,
  type UciStrength,
} from "./opponentPolicy.js"
import {
  STANDARD_CHICKEN_NODE_LIMIT,
  STANDARD_CHICKEN_OPENINGS,
} from "./standardChickenCandidatePlan.js"

export const WEB_OPPONENT_CANDIDATE_PROBABILITIES = [
  8_000, 6_500, 5_000, 4_000,
] as const
export const WEB_OPPONENT_CANDIDATE_PAIRS_PER_EDGE = 20 as const
const CHESS960_OPENING_COUNT = 10
const EXPERIMENT_SEED = 42
export const WEB_OPPONENT_REFERENCE_ELO = 1320
const SECOND_REFERENCE_ELO = 1600

export function createWebOpponentCalibrationPolicy(
  variant: CalibrationVariant,
  strength: UciStrength,
  randomMoveProbabilityBasisPoints: number,
): OpponentPolicy {
  const reference = strength.kind === "uci-elo"
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant,
    engine: reference
      ? STOCKFISH_18_BUILD_IDENTITY
      : WEB_CALIBRATION_ENGINE_IDENTITY,
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
      legalMoveGeneratorVersion:
        CALIBRATION_CANONICAL_LEGAL_MOVE_GENERATOR_VERSION,
    },
    randomness: {
      algorithmVersion: CALIBRATION_RANDOM_ALGORITHM_VERSION,
      seedDerivationVersion: OPPONENT_POSITION_SEED_DERIVATION_VERSION,
    },
    openingBook: { kind: "disabled" },
    runtime: {
      target: reference ? STOCKFISH_18_RUNTIME_TARGET : "web-lite-wasm-node",
      adapterVersion: reference
        ? STOCKFISH_PROCESS_ADAPTER_VERSION
        : WEB_CALIBRATION_ADAPTER_VERSION,
    },
  }
}

function chess960Openings(): readonly CalibrationOpening[] {
  const selected = shuffleDeterministically(
    Array.from({ length: CHESS960_POSITION_COUNT }, (_, number) => ({
      number,
    })),
    deriveCalibrationSeed(
      parseCalibrationRootSeed(EXPERIMENT_SEED),
      "web-opponent-chess960-openings/v1",
    ),
  ).slice(0, CHESS960_OPENING_COUNT)
  return selected.map(({ number }) => {
    const parsed = parseChess960PositionId(number)
    if (!parsed.ok)
      throw new Error("Selected Chess960 calibration position must be valid.")
    return {
      id: `chess960-${String(number)}`,
      fen: createChess960InitialFen(parsed.positionId),
      chess960PositionId: parsed.positionId,
    }
  })
}

export function createWebOpponentComparisonPlan(
  variant: CalibrationVariant,
  randomMoveProbabilities: readonly number[],
  referenceElos: readonly number[],
): CalibrationPlan {
  const orderedPolicies = [
    ...randomMoveProbabilities.map((probability) => ({
      id: `web-random-${String(probability).padStart(5, "0")}`,
      policy: createWebOpponentCalibrationPolicy(
        variant,
        { kind: "full-strength" },
        probability,
      ),
    })),
    ...referenceElos.map((elo) => ({
      id: `reference-${String(elo)}`,
      policy: createWebOpponentCalibrationPolicy(
        variant,
        { kind: "uci-elo", elo },
        0,
      ),
    })),
  ]
  const openings =
    variant === "standard" ? STANDARD_CHICKEN_OPENINGS : chess960Openings()
  return createCalibrationPlan({
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    variant,
    seed: EXPERIMENT_SEED,
    openings,
    edges: orderedPolicies.slice(0, -1).map((first, index) => {
      const second = orderedPolicies[index + 1]
      if (second === undefined)
        throw new Error("Calibration neighbors must be connected.")
      return {
        id: `${first.id}-vs-${second.id}`,
        pairsPerOpening:
          WEB_OPPONENT_CANDIDATE_PAIRS_PER_EDGE / openings.length,
        policyA: first.policy,
        policyB: second.policy,
      }
    }),
  })
}

export function createWebOpponentReferenceAnchor(
  variant: CalibrationVariant,
): RunBayesEloInput["anchor"] {
  return {
    elo: WEB_OPPONENT_REFERENCE_ELO,
    policyFingerprint: fingerprintOpponentPolicy(
      createWebOpponentCalibrationPolicy(
        variant,
        { kind: "uci-elo", elo: WEB_OPPONENT_REFERENCE_ELO },
        0,
      ),
    ),
  }
}

export default function createWebOpponentCandidatePlan(
  variant: CalibrationVariant,
): Readonly<{ plan: CalibrationPlan; anchor: RunBayesEloInput["anchor"] }> {
  return {
    plan: createWebOpponentComparisonPlan(
      variant,
      WEB_OPPONENT_CANDIDATE_PROBABILITIES,
      [WEB_OPPONENT_REFERENCE_ELO, SECOND_REFERENCE_ELO],
    ),
    anchor: createWebOpponentReferenceAnchor(variant),
  }
}

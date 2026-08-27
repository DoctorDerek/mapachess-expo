import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import { STOCKFISH_PROCESS_ADAPTER_VERSION } from "@mapachess/stockfish/uci-process-adapter"
import type { CalibrationColor } from "./calibrationGameTypes.js"
import type { CalibrationPolicyRecord } from "./calibrationPlan.js"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "./deterministicRandom.js"
import fingerprintOpponentPolicy, {
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  type OpponentPolicy,
  type OpponentPolicyFingerprint,
} from "./opponentPolicy.js"

export type CalibrationPolicyMap = ReadonlyMap<
  OpponentPolicyFingerprint,
  OpponentPolicy
>

function validateExecutablePolicy(policy: OpponentPolicy): void {
  if (policy.variant !== "standard") {
    throw new TypeError(
      "Chess960 calibration execution is unavailable until a validated Chess960 rules owner exists.",
    )
  }

  if (policy.search.threads !== 1) {
    throw new TypeError("Calibration policies must use exactly one thread.")
  }

  if (policy.search.multiPv !== 1) {
    throw new TypeError("Calibration policies must use MultiPV 1.")
  }

  if (policy.search.ponder) {
    throw new TypeError("Calibration policies must disable pondering.")
  }

  if (
    policy.search.commandProtocolVersion !==
    CALIBRATION_COMMAND_PROTOCOL_VERSION
  ) {
    throw new TypeError("Unsupported calibration command protocol version.")
  }

  if (
    policy.moveSelection.algorithmVersion !==
    CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION
  ) {
    throw new TypeError("Unsupported calibration move-selection version.")
  }

  if (
    policy.moveSelection.legalMoveGeneratorVersion !==
    CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION
  ) {
    throw new TypeError("Unsupported calibration legal-move generator version.")
  }

  if (
    policy.randomness.algorithmVersion !==
      CALIBRATION_RANDOM_ALGORITHM_VERSION ||
    policy.randomness.seedDerivationVersion !==
      CALIBRATION_SEED_DERIVATION_VERSION
  ) {
    throw new TypeError("Unsupported calibration randomness version.")
  }

  if (policy.runtime.adapterVersion !== STOCKFISH_PROCESS_ADAPTER_VERSION) {
    throw new TypeError("Unsupported Stockfish process adapter version.")
  }
}

export function indexCalibrationPolicies(
  records: readonly CalibrationPolicyRecord[],
): CalibrationPolicyMap {
  const policies = new Map<OpponentPolicyFingerprint, OpponentPolicy>()

  for (const record of records) {
    const policy = record.policy
    const fingerprint = fingerprintOpponentPolicy(policy)

    if (fingerprint !== record.fingerprint) {
      throw new TypeError(
        `Calibration policy record ${record.fingerprint} does not match its policy.`,
      )
    }

    if (policies.has(fingerprint)) {
      throw new TypeError(
        `Calibration policy fingerprint must be unique: ${fingerprint}.`,
      )
    }

    validateExecutablePolicy(policy)
    policies.set(fingerprint, policy)
  }

  return policies
}

export function requireCalibrationPolicy(
  policies: CalibrationPolicyMap,
  fingerprint: OpponentPolicyFingerprint,
  color: CalibrationColor,
): OpponentPolicy {
  const policy = policies.get(fingerprint)

  if (policy === undefined) {
    throw new TypeError(
      `Calibration ${color} policy is missing: ${fingerprint}.`,
    )
  }

  return policy
}

export function stockfishConfigurationFromPolicy(
  policy: OpponentPolicy,
): StockfishEngineConfiguration {
  return {
    variant: policy.variant,
    strength: policy.search.strength,
    threads: policy.search.threads,
    hashMegabytes: policy.search.hashMegabytes,
    multiPv: policy.search.multiPv,
    ponder: policy.search.ponder,
  }
}

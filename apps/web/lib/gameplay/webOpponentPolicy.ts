import type { MatchVariant } from "@mapachess/match/match-variant"
import stockfishOpponent, {
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  DETERMINISTIC_RANDOM_ALGORITHM_VERSION,
  OPPONENT_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POSITION_SEED_DERIVATION_VERSION,
} from "@mapachess/stockfish/opponent-move-selection"
import {
  WEB_CALIBRATED_LADDER,
  WEB_CHALLENGE_PRESETS,
  WEB_OPPONENT_ENGINE_CONFIGURATION,
  WEB_OPPONENT_NODE_LIMIT,
} from "@mapachess/stockfish/web-opponent-policy"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_SOURCE_REVISION,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "@mapachess/stockfish/web-runtime-identity"
import webSha256, { type Sha256SubtleCrypto } from "../profile/webSha256"
import provisionalWebProbabilities from "./provisionalWebProbabilities"

export type WebOpponentPolicy = Readonly<{
  calibrationFingerprint?: `sha256:${string}`
  fingerprint: string
  nodeLimit: number
  opponentId: StockfishOpponentId
  randomMoveProbabilityBasisPoints: number
  variant: MatchVariant
  targetElo: number
}>

async function findProvisionalPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  targetElo: number,
  mode: "challenge" | "story",
  savedFingerprint: string,
  subtleCrypto: Sha256SubtleCrypto,
): Promise<WebOpponentPolicy | undefined> {
  if (
    mode === "story" &&
    opponentId === "chicken-stockfish" &&
    targetElo === 100
  ) {
    const fingerprint = [
      `mapachess-${variant}-chicken-web-policy/v1`,
      `stockfish-js-source/${STOCKFISH_18_WEB_SOURCE_REVISION}`,
      `wasm-sha256/${STOCKFISH_18_WEB_WASM_ARTIFACT.sha256}`,
      `nodes/${String(WEB_OPPONENT_NODE_LIMIT)}`,
      "random-basis-points/8000",
      OPPONENT_POSITION_SEED_DERIVATION_VERSION,
    ].join("|")
    if (fingerprint === savedFingerprint)
      return Object.freeze({
        opponentId,
        variant,
        targetElo,
        fingerprint,
        nodeLimit: WEB_OPPONENT_NODE_LIMIT,
        randomMoveProbabilityBasisPoints: 8000,
      })
  }
  const prefix =
    mode === "story"
      ? ["mapachess-provisional-web-ladder-policy/v1", variant, opponentId]
      : [
          "mapachess-provisional-web-challenge-policy/v1",
          variant,
          `target-elo/${String(targetElo)}`,
        ]
  for (const bp of provisionalWebProbabilities(variant, targetElo)) {
    const policy = await createWebPolicy(
      opponentId,
      variant,
      targetElo,
      bp,
      prefix,
      subtleCrypto,
    )
    if (policy.fingerprint === savedFingerprint) return policy
  }
  return undefined
}

export const webChallengeDifficultyTargets = (
  variant: MatchVariant,
): readonly number[] =>
  WEB_CHALLENGE_PRESETS[variant].map(({ targetElo }) => targetElo)

export default async function resolveWebOpponentPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
  savedFingerprint?: string,
): Promise<WebOpponentPolicy> {
  const opponent = stockfishOpponent(opponentId)
  const measured = WEB_CHALLENGE_PRESETS[variant].find(
    ({ targetElo }) => targetElo === opponent.storyTargetElo,
  )
  if (measured === undefined) {
    throw new TypeError("This opponent has no measured web policy.")
  }

  const current = await createCalibratedWebPolicy(
    opponentId,
    variant,
    opponent.storyTargetElo,
    measured,
    subtleCrypto,
  )
  if (
    savedFingerprint === undefined ||
    current.fingerprint === savedFingerprint
  )
    return current
  const originalTarget = opponent.originalStoryTargetElo
  if (originalTarget !== null) {
    const original = WEB_CALIBRATED_LADDER[variant][originalTarget / 100 - 1]
    if (original !== undefined) {
      const historical = await createCalibratedWebPolicy(
        opponentId,
        variant,
        originalTarget,
        original,
        subtleCrypto,
      )
      if (historical.fingerprint === savedFingerprint) return historical
    }
    const provisional = await findProvisionalPolicy(
      opponentId,
      variant,
      originalTarget,
      "story",
      savedFingerprint,
      subtleCrypto,
    )
    if (provisional !== undefined) return provisional
  }
  throw new TypeError("The saved Story opponent policy is unavailable.")
}

const createCalibratedWebPolicy = (
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  targetElo: number,
  measured: Readonly<{
    randomMoveProbabilityBasisPoints: number
    calibrationFingerprint: `sha256:${string}`
  }>,
  subtleCrypto: Sha256SubtleCrypto,
): Promise<WebOpponentPolicy> =>
  createWebPolicy(
    opponentId,
    variant,
    targetElo,
    measured.randomMoveProbabilityBasisPoints,
    [
      "mapachess-calibrated-web-worker-policy/v1",
      variant,
      `target-elo/${String(targetElo)}`,
      `calibration-policy/${measured.calibrationFingerprint}`,
      "stockfish-web-worker-uci/v1",
    ],
    subtleCrypto,
    measured.calibrationFingerprint,
  )

async function createWebPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  targetElo: number,
  randomMoveProbabilityBasisPoints: number,
  identityPrefix: readonly string[],
  subtleCrypto: Sha256SubtleCrypto,
  calibrationFingerprint?: `sha256:${string}`,
): Promise<WebOpponentPolicy> {
  const configuration = WEB_OPPONENT_ENGINE_CONFIGURATION
  const identity = [
    ...identityPrefix,
    `stockfish-js-source/${STOCKFISH_18_WEB_SOURCE_REVISION}`,
    `loader-sha256/${STOCKFISH_18_WEB_LOADER_ARTIFACT.sha256}`,
    `wasm-sha256/${STOCKFISH_18_WEB_WASM_ARTIFACT.sha256}`,
    `nodes/${String(WEB_OPPONENT_NODE_LIMIT)}`,
    `random-basis-points/${String(randomMoveProbabilityBasisPoints)}`,
    `threads/${String(configuration.threads)}`,
    `hash-megabytes/${String(configuration.hashMegabytes)}`,
    `multipv/${String(configuration.multiPv)}`,
    `ponder/${String(configuration.ponder)}`,
    configuration.strength.kind,
    "canonical-uci-sorted-legal-moves/v1",
    OPPONENT_MOVE_SELECTION_ALGORITHM_VERSION,
    DETERMINISTIC_RANDOM_ALGORITHM_VERSION,
    OPPONENT_POSITION_SEED_DERIVATION_VERSION,
  ].join("|")
  const fingerprint = `sha256:${await webSha256(identity, subtleCrypto)}`
  return Object.freeze({
    ...(calibrationFingerprint === undefined ? {} : { calibrationFingerprint }),
    fingerprint,
    nodeLimit: WEB_OPPONENT_NODE_LIMIT,
    opponentId,
    randomMoveProbabilityBasisPoints,
    variant,
    targetElo,
  })
}

export async function resolveWebChallengePolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  difficultyTargetElo?: number,
  savedFingerprint?: string,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
): Promise<WebOpponentPolicy> {
  const presets = WEB_CHALLENGE_PRESETS[variant]
  const targets =
    difficultyTargetElo === undefined
      ? presets
      : presets.filter(({ targetElo }) => targetElo === difficultyTargetElo)
  if (targets.length === 0)
    throw new TypeError(
      "This Challenge difficulty has no supported web preset.",
    )

  for (const preset of targets) {
    const target = preset.targetElo
    const current = await createCalibratedWebPolicy(
      opponentId,
      variant,
      target,
      preset,
      subtleCrypto,
    )
    if (
      savedFingerprint === undefined ||
      current.fingerprint === savedFingerprint
    )
      return current

    // Only the original 100-Elo rungs had earlier calibrated and provisional policies.
    const original = WEB_CALIBRATED_LADDER[variant][target / 100 - 1]
    if (original === undefined) continue
    if (original.calibrationFingerprint !== preset.calibrationFingerprint) {
      const previous = await createCalibratedWebPolicy(
        opponentId,
        variant,
        target,
        original,
        subtleCrypto,
      )
      if (previous.fingerprint === savedFingerprint) return previous
    }
    const previous = await findProvisionalPolicy(
      opponentId,
      variant,
      target,
      "challenge",
      savedFingerprint,
      subtleCrypto,
    )
    if (previous !== undefined) return previous
    // Before independent Challenge strength, matches used the chosen animal's Story policy.
    if (stockfishOpponent(opponentId).originalStoryTargetElo === target) {
      const story = await findProvisionalPolicy(
        opponentId,
        variant,
        target,
        "story",
        savedFingerprint,
        subtleCrypto,
      )
      if (story !== undefined) return story
    }
  }
  throw new TypeError("The saved Challenge opponent policy is unavailable.")
}

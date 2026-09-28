import type { MatchVariant } from "@mapachess/match/match-variant"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  DETERMINISTIC_RANDOM_ALGORITHM_VERSION,
  OPPONENT_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POSITION_SEED_DERIVATION_VERSION,
} from "@mapachess/stockfish/opponent-move-selection"
import {
  WEB_CALIBRATED_LADDER,
  WEB_OPPONENT_ENGINE_CONFIGURATION,
  WEB_OPPONENT_NODE_LIMIT,
} from "@mapachess/stockfish/web-opponent-policy"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_SOURCE_REVISION,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "@mapachess/stockfish/web-runtime-identity"
import webSha256, { type Sha256SubtleCrypto } from "../profile/webSha256"

export type WebOpponentPolicy = Readonly<{
  calibrationFingerprint?: `sha256:${string}`
  fingerprint: string
  nodeLimit: number
  opponentId: StockfishOpponentId
  randomMoveProbabilityBasisPoints: number
  variant: MatchVariant
  targetElo: number
}>

const LEGACY_WEB_LADDER_RANDOM_PRESETS = [
  { standard: 9_000, chess960: 8_350 },
  8_000,
  7_350,
  6_550,
  6_150,
  5_500,
  { standard: 5_000, chess960: 5_400 },
  { standard: 4_450, chess960: 5_000 },
  { standard: 3_850, chess960: 4_450 },
  3_650,
  3_200,
  2_800,
  2_550,
  2_325,
  2_000,
  1_725,
  1_350,
  1_125,
  825,
  550,
  400,
  250,
  80,
] as const

const legacyRandomBasisPoints = (
  variant: MatchVariant,
  storyPosition: number,
): number => {
  const preset = LEGACY_WEB_LADDER_RANDOM_PRESETS[storyPosition - 1]
  if (preset === undefined)
    throw new TypeError("The saved opponent has no prior web policy.")
  return typeof preset === "number" ? preset : preset[variant]
}

const webChallengePresets = (
  variant: MatchVariant,
): readonly Readonly<{
  targetElo: number
  storyPosition: number
  randomBasisPoints: number
  calibrationFingerprint: `sha256:${string}`
}>[] =>
  STOCKFISH_OPPONENTS.flatMap(({ storyPosition, storyTargetElo }) => {
    const measured = WEB_CALIBRATED_LADDER[variant][storyPosition - 1]
    return measured === undefined
      ? []
      : [
          {
            targetElo: storyTargetElo,
            storyPosition,
            randomBasisPoints: measured.randomMoveProbabilityBasisPoints,
            calibrationFingerprint: measured.calibrationFingerprint,
          },
        ]
  })

export const webChallengeDifficultyTargets = (
  variant: MatchVariant,
): readonly number[] =>
  webChallengePresets(variant).map(({ targetElo }) => targetElo)

export default async function resolveWebOpponentPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
  savedFingerprint?: string,
): Promise<WebOpponentPolicy> {
  const opponent = stockfishOpponent(opponentId)
  const measured = WEB_CALIBRATED_LADDER[variant][opponent.storyPosition - 1]
  if (measured === undefined) {
    throw new TypeError("This opponent has no measured web policy.")
  }

  if (savedFingerprint !== undefined) {
    const legacy = await createWebPolicy(
      opponentId,
      variant,
      opponent.storyTargetElo,
      legacyRandomBasisPoints(variant, opponent.storyPosition),
      ["mapachess-provisional-web-ladder-policy/v1", variant, opponentId],
      subtleCrypto,
    )
    if (legacy.fingerprint === savedFingerprint) return legacy
  }

  return createCalibratedWebPolicy(
    opponentId,
    variant,
    opponent.storyTargetElo,
    measured,
    subtleCrypto,
  )
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
  const presets = webChallengePresets(variant)
  let defaultPolicy: WebOpponentPolicy | undefined
  for (const {
    targetElo: target,
    storyPosition,
    randomBasisPoints,
    calibrationFingerprint,
  } of presets) {
    if (difficultyTargetElo !== undefined && target !== difficultyTargetElo)
      continue
    const policy = await createCalibratedWebPolicy(
      opponentId,
      variant,
      target,
      {
        randomMoveProbabilityBasisPoints: randomBasisPoints,
        calibrationFingerprint,
      },
      subtleCrypto,
    )
    defaultPolicy ??= policy
    if (
      savedFingerprint === undefined ||
      policy.fingerprint === savedFingerprint
    )
      return policy
    const legacy = await createWebPolicy(
      opponentId,
      variant,
      target,
      legacyRandomBasisPoints(variant, storyPosition),
      [
        "mapachess-provisional-web-challenge-policy/v1",
        variant,
        `target-elo/${String(target)}`,
      ],
      subtleCrypto,
    )
    if (legacy.fingerprint === savedFingerprint) return legacy
  }
  if (defaultPolicy === undefined) {
    throw new TypeError(
      "This Challenge difficulty has no supported web preset.",
    )
  }
  return defaultPolicy
}

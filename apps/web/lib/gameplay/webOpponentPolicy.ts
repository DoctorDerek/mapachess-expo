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
  PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS,
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
  fingerprint: string
  nodeLimit: number
  opponentId: StockfishOpponentId
  randomMoveProbabilityBasisPoints: number
  variant: MatchVariant
  targetElo: number
}>

const webChallengePresets = (
  variant: MatchVariant,
): readonly Readonly<{ targetElo: number; randomBasisPoints: number }>[] =>
  STOCKFISH_OPPONENTS.flatMap(({ storyPosition, storyTargetElo }) => {
    const randomBasisPoints =
      PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS[variant][storyPosition - 1]
    return randomBasisPoints === undefined
      ? []
      : [{ targetElo: storyTargetElo, randomBasisPoints }]
  })

export const webChallengeDifficultyTargets = (
  variant: MatchVariant,
): readonly number[] =>
  webChallengePresets(variant).map(({ targetElo }) => targetElo)

export default async function resolveWebOpponentPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
): Promise<WebOpponentPolicy> {
  const opponent = stockfishOpponent(opponentId)
  const randomMoveProbabilityBasisPoints =
    PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS[variant][
      opponent.storyPosition - 1
    ]
  if (randomMoveProbabilityBasisPoints === undefined) {
    throw new TypeError("This opponent has no measured web policy.")
  }

  return createWebPolicy(
    opponentId,
    variant,
    opponent.storyTargetElo,
    randomMoveProbabilityBasisPoints,
    ["mapachess-provisional-web-ladder-policy/v1", variant, opponentId],
    subtleCrypto,
  )
}

async function createWebPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  targetElo: number,
  randomMoveProbabilityBasisPoints: number,
  identityPrefix: readonly string[],
  subtleCrypto: Sha256SubtleCrypto,
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
  for (const { targetElo: target, randomBasisPoints } of presets) {
    if (difficultyTargetElo !== undefined && target !== difficultyTargetElo)
      continue
    const policy = await createWebPolicy(
      opponentId,
      variant,
      target,
      randomBasisPoints,
      [
        "mapachess-provisional-web-challenge-policy/v1",
        variant,
        `target-elo/${String(target)}`,
      ],
      subtleCrypto,
    )
    defaultPolicy ??= policy
    if (
      difficultyTargetElo !== undefined ||
      savedFingerprint === undefined ||
      policy.fingerprint === savedFingerprint
    )
      return policy
  }
  if (defaultPolicy === undefined) {
    throw new TypeError(
      "This Challenge difficulty has no supported web preset.",
    )
  }
  return defaultPolicy
}

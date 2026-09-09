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
}>

const LEGACY_CHICKEN_PARAMETERS = Object.freeze({
  nodeLimit: 10_000,
  randomMoveProbabilityBasisPoints: 8_000,
})

export function legacyChickenWebPolicy(
  variant: MatchVariant,
): WebOpponentPolicy {
  return Object.freeze({
    fingerprint: [
      `mapachess-${variant}-chicken-web-policy/v1`,
      `stockfish-js-source/${STOCKFISH_18_WEB_SOURCE_REVISION}`,
      `wasm-sha256/${STOCKFISH_18_WEB_WASM_ARTIFACT.sha256}`,
      `nodes/${String(LEGACY_CHICKEN_PARAMETERS.nodeLimit)}`,
      `random-basis-points/${String(LEGACY_CHICKEN_PARAMETERS.randomMoveProbabilityBasisPoints)}`,
      OPPONENT_POSITION_SEED_DERIVATION_VERSION,
    ].join("|"),
    ...LEGACY_CHICKEN_PARAMETERS,
    opponentId: "chicken-stockfish",
    variant,
  })
}

export default async function resolveWebOpponentPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  savedFingerprint?: string,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
): Promise<WebOpponentPolicy> {
  if (opponentId === "chicken-stockfish" && savedFingerprint !== undefined) {
    const legacy = legacyChickenWebPolicy(variant)
    if (savedFingerprint === legacy.fingerprint) return legacy
  }

  const opponent = stockfishOpponent(opponentId)
  const randomMoveProbabilityBasisPoints =
    PROVISIONAL_WEB_LADDER_RANDOM_BASIS_POINTS[variant][
      opponent.storyPosition - 1
    ]
  if (randomMoveProbabilityBasisPoints === undefined) {
    throw new TypeError("This opponent has no measured web policy.")
  }

  const configuration = WEB_OPPONENT_ENGINE_CONFIGURATION
  const identity = [
    "mapachess-provisional-web-ladder-policy/v1",
    variant,
    opponentId,
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
  if (savedFingerprint !== undefined && savedFingerprint !== fingerprint) {
    throw new TypeError("Saved opponent policy does not match this runtime.")
  }

  return Object.freeze({
    fingerprint,
    nodeLimit: WEB_OPPONENT_NODE_LIMIT,
    opponentId,
    randomMoveProbabilityBasisPoints,
    variant,
  })
}

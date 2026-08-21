import { createHash } from "node:crypto"

export const OPPONENT_POLICY_SCHEMA_VERSION = 1 as const
export const RANDOM_MOVE_PROBABILITY_SCALE = 10_000 as const

const POLICY_FINGERPRINT_NAMESPACE = "mapachess.opponent-policy/v1"
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

declare const opponentPolicyFingerprintBrand: unique symbol
declare const sha256HexBrand: unique symbol

export type CalibrationVariant = "standard" | "chess960"
export type OpponentPolicyFingerprint = `sha256:${string}` & {
  readonly [opponentPolicyFingerprintBrand]: true
}
export type Sha256Hex = string & { readonly [sha256HexBrand]: true }

export type UciStrength =
  | Readonly<{ kind: "full-strength" }>
  | Readonly<{ elo: number; kind: "uci-elo" }>

export type TablebasePolicy = Readonly<{ kind: "disabled" }>

export type OpeningBookPolicy = Readonly<{ kind: "disabled" }>

export type OpponentPolicy = Readonly<{
  schemaVersion: typeof OPPONENT_POLICY_SCHEMA_VERSION
  variant: CalibrationVariant
  engine: Readonly<{
    binarySha256: Sha256Hex
    name: "stockfish"
    networkSha256: Sha256Hex
    sourceRevision: string
    version: string
  }>
  moveSelection: Readonly<{
    algorithmVersion: string
    kind: "best-or-uniform-random-legal"
    legalMoveGeneratorVersion: string
    randomMoveProbabilityBasisPoints: number
  }>
  openingBook: OpeningBookPolicy
  randomness: Readonly<{
    algorithmVersion: string
    seedDerivationVersion: string
  }>
  runtime: Readonly<{
    adapterVersion: string
    target: string
  }>
  search: Readonly<{
    commandProtocolVersion: string
    hashMegabytes: number
    multiPv: number
    nodeLimit: number
    ponder: boolean
    strength: UciStrength
    tablebases: TablebasePolicy
    threads: number
  }>
}>

export function parseSha256Hex(value: string, label = "SHA-256"): Sha256Hex {
  if (!SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(
      `${label} must be exactly 64 lowercase hexadecimal characters.`,
    )
  }

  return value as Sha256Hex
}

function assertStableText(value: string, label: string): void {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${label} must be nonempty, trimmed, and free of control characters.`,
    )
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function assertProbabilityBasisPoints(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > RANDOM_MOVE_PROBABILITY_SCALE
  ) {
    throw new TypeError(
      `randomMoveProbabilityBasisPoints must be an integer from 0 through ${RANDOM_MOVE_PROBABILITY_SCALE}.`,
    )
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean.`)
  }
}

export function validateOpponentPolicy(policy: OpponentPolicy): void {
  if (policy.schemaVersion !== OPPONENT_POLICY_SCHEMA_VERSION) {
    throw new TypeError(
      `schemaVersion must be ${OPPONENT_POLICY_SCHEMA_VERSION}.`,
    )
  }

  if (policy.variant !== "standard" && policy.variant !== "chess960") {
    throw new TypeError('variant must be "standard" or "chess960".')
  }

  if (policy.engine.name !== "stockfish") {
    throw new TypeError('engine.name must be "stockfish".')
  }

  assertStableText(policy.engine.version, "engine.version")
  assertStableText(policy.engine.sourceRevision, "engine.sourceRevision")
  parseSha256Hex(policy.engine.binarySha256, "engine.binarySha256")
  parseSha256Hex(policy.engine.networkSha256, "engine.networkSha256")

  if (policy.search.strength.kind === "uci-elo") {
    assertPositiveSafeInteger(policy.search.strength.elo, "search.strength.elo")
  } else if (policy.search.strength.kind !== "full-strength") {
    throw new TypeError(
      'search.strength.kind must be "full-strength" or "uci-elo".',
    )
  }

  assertPositiveSafeInteger(policy.search.nodeLimit, "search.nodeLimit")
  assertPositiveSafeInteger(policy.search.threads, "search.threads")
  assertPositiveSafeInteger(policy.search.hashMegabytes, "search.hashMegabytes")
  assertPositiveSafeInteger(policy.search.multiPv, "search.multiPv")
  assertBoolean(policy.search.ponder, "search.ponder")
  assertStableText(
    policy.search.commandProtocolVersion,
    "search.commandProtocolVersion",
  )

  if (policy.search.tablebases.kind !== "disabled") {
    throw new TypeError('search.tablebases.kind must be "disabled".')
  }

  if (policy.moveSelection.kind !== "best-or-uniform-random-legal") {
    throw new TypeError(
      'moveSelection.kind must be "best-or-uniform-random-legal".',
    )
  }

  assertProbabilityBasisPoints(
    policy.moveSelection.randomMoveProbabilityBasisPoints,
  )
  assertStableText(
    policy.moveSelection.algorithmVersion,
    "moveSelection.algorithmVersion",
  )
  assertStableText(
    policy.moveSelection.legalMoveGeneratorVersion,
    "moveSelection.legalMoveGeneratorVersion",
  )
  assertStableText(
    policy.randomness.algorithmVersion,
    "randomness.algorithmVersion",
  )
  assertStableText(
    policy.randomness.seedDerivationVersion,
    "randomness.seedDerivationVersion",
  )

  if (policy.openingBook.kind !== "disabled") {
    throw new TypeError('openingBook.kind must be "disabled".')
  }

  assertStableText(policy.runtime.target, "runtime.target")
  assertStableText(policy.runtime.adapterVersion, "runtime.adapterVersion")
}

export function serializeOpponentPolicy(policy: OpponentPolicy): string {
  validateOpponentPolicy(policy)

  const strength =
    policy.search.strength.kind === "uci-elo"
      ? { kind: policy.search.strength.kind, elo: policy.search.strength.elo }
      : { kind: policy.search.strength.kind }
  const tablebases = { kind: policy.search.tablebases.kind }
  const openingBook = { kind: policy.openingBook.kind }

  return JSON.stringify({
    namespace: POLICY_FINGERPRINT_NAMESPACE,
    schemaVersion: policy.schemaVersion,
    variant: policy.variant,
    engine: {
      name: policy.engine.name,
      version: policy.engine.version,
      sourceRevision: policy.engine.sourceRevision,
      binarySha256: policy.engine.binarySha256,
      networkSha256: policy.engine.networkSha256,
    },
    search: {
      strength,
      nodeLimit: policy.search.nodeLimit,
      threads: policy.search.threads,
      hashMegabytes: policy.search.hashMegabytes,
      multiPv: policy.search.multiPv,
      ponder: policy.search.ponder,
      commandProtocolVersion: policy.search.commandProtocolVersion,
      tablebases,
    },
    moveSelection: {
      kind: policy.moveSelection.kind,
      randomMoveProbabilityBasisPoints:
        policy.moveSelection.randomMoveProbabilityBasisPoints,
      algorithmVersion: policy.moveSelection.algorithmVersion,
      legalMoveGeneratorVersion: policy.moveSelection.legalMoveGeneratorVersion,
    },
    randomness: {
      algorithmVersion: policy.randomness.algorithmVersion,
      seedDerivationVersion: policy.randomness.seedDerivationVersion,
    },
    openingBook,
    runtime: {
      target: policy.runtime.target,
      adapterVersion: policy.runtime.adapterVersion,
    },
  })
}

export default function fingerprintOpponentPolicy(
  policy: OpponentPolicy,
): OpponentPolicyFingerprint {
  const digest = createHash("sha256")
    .update(serializeOpponentPolicy(policy), "utf8")
    .digest("hex")

  return `sha256:${digest}` as OpponentPolicyFingerprint
}

import { parseStockfishBuildIdentity } from "@mapachess/stockfish/build-identity"
import {
  OPPONENT_POLICY_SCHEMA_VERSION,
  validateOpponentPolicy,
  type CalibrationVariant,
  type OpeningBookPolicy,
  type OpponentPolicy,
  type TablebasePolicy,
  type UciStrength,
} from "./opponentPolicy.js"

const POLICY_FINGERPRINT_NAMESPACE = "mapachess.opponent-policy/v2"

type UnknownRecord = Record<string, unknown>

function parseRecord(
  value: unknown,
  label: string,
  expectedKeys: readonly string[],
): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }

  const record = value as UnknownRecord
  const actualKeys = Object.keys(record).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()

  if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
    throw new TypeError(
      `${label} must contain exactly: ${sortedExpectedKeys.join(", ")}.`,
    )
  }

  return record
}

function parseObject(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }

  return value as UnknownRecord
}

function parseString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string.`)
  }

  return value
}

function parseNumber(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new TypeError(`${label} must be a number.`)
  }

  return value
}

function parseBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean.`)
  }

  return value
}

function parseLiteral<T extends string>(
  value: unknown,
  expected: T,
  label: string,
): T {
  if (value !== expected) {
    throw new TypeError(`${label} must be ${JSON.stringify(expected)}.`)
  }

  return expected
}

function parseVariant(value: unknown): CalibrationVariant {
  if (value !== "standard" && value !== "chess960") {
    throw new TypeError('variant must be "standard" or "chess960".')
  }

  return value
}

function parseStrength(value: unknown): UciStrength {
  const base = parseObject(value, "search.strength")

  if (base.kind === "full-strength") {
    const full = parseRecord(value, "search.strength", ["kind"])
    return { kind: parseLiteral(full.kind, "full-strength", "strength.kind") }
  }

  const limited = parseRecord(value, "search.strength", ["elo", "kind"])
  return {
    kind: parseLiteral(limited.kind, "uci-elo", "strength.kind"),
    elo: parseNumber(limited.elo, "strength.elo"),
  }
}

function parseDisabledPolicy(
  value: unknown,
  label: string,
): OpeningBookPolicy & TablebasePolicy {
  const record = parseRecord(value, label, ["kind"])
  return { kind: parseLiteral(record.kind, "disabled", `${label}.kind`) }
}

function parseJson(serializedPolicy: string): unknown {
  if (typeof serializedPolicy !== "string") {
    throw new TypeError("serializedPolicy must be a string.")
  }

  try {
    return JSON.parse(serializedPolicy) as unknown
  } catch (error) {
    throw new TypeError("serializedPolicy must be valid JSON.", {
      cause: error,
    })
  }
}

export default function parseSerializedOpponentPolicy(
  serializedPolicy: string,
): OpponentPolicy {
  const root = parseRecord(parseJson(serializedPolicy), "serializedPolicy", [
    "engine",
    "moveSelection",
    "namespace",
    "openingBook",
    "randomness",
    "runtime",
    "schemaVersion",
    "search",
    "variant",
  ])
  parseLiteral(root.namespace, POLICY_FINGERPRINT_NAMESPACE, "namespace")

  if (root.schemaVersion !== OPPONENT_POLICY_SCHEMA_VERSION) {
    throw new TypeError(
      `schemaVersion must be ${OPPONENT_POLICY_SCHEMA_VERSION}.`,
    )
  }

  const search = parseRecord(root.search, "search", [
    "commandProtocolVersion",
    "hashMegabytes",
    "multiPv",
    "nodeLimit",
    "ponder",
    "strength",
    "tablebases",
    "threads",
  ])
  const moveSelection = parseRecord(root.moveSelection, "moveSelection", [
    "algorithmVersion",
    "kind",
    "legalMoveGeneratorVersion",
    "randomMoveProbabilityBasisPoints",
  ])
  const randomness = parseRecord(root.randomness, "randomness", [
    "algorithmVersion",
    "seedDerivationVersion",
  ])
  const runtime = parseRecord(root.runtime, "runtime", [
    "adapterVersion",
    "target",
  ])
  const policy: OpponentPolicy = {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant: parseVariant(root.variant),
    engine: parseStockfishBuildIdentity(root.engine),
    search: {
      strength: parseStrength(search.strength),
      nodeLimit: parseNumber(search.nodeLimit, "search.nodeLimit"),
      threads: parseNumber(search.threads, "search.threads"),
      hashMegabytes: parseNumber(search.hashMegabytes, "search.hashMegabytes"),
      multiPv: parseNumber(search.multiPv, "search.multiPv"),
      ponder: parseBoolean(search.ponder, "search.ponder"),
      commandProtocolVersion: parseString(
        search.commandProtocolVersion,
        "search.commandProtocolVersion",
      ),
      tablebases: parseDisabledPolicy(search.tablebases, "search.tablebases"),
    },
    moveSelection: {
      kind: parseLiteral(
        moveSelection.kind,
        "best-or-uniform-random-legal",
        "moveSelection.kind",
      ),
      randomMoveProbabilityBasisPoints: parseNumber(
        moveSelection.randomMoveProbabilityBasisPoints,
        "moveSelection.randomMoveProbabilityBasisPoints",
      ),
      algorithmVersion: parseString(
        moveSelection.algorithmVersion,
        "moveSelection.algorithmVersion",
      ),
      legalMoveGeneratorVersion: parseString(
        moveSelection.legalMoveGeneratorVersion,
        "moveSelection.legalMoveGeneratorVersion",
      ),
    },
    randomness: {
      algorithmVersion: parseString(
        randomness.algorithmVersion,
        "randomness.algorithmVersion",
      ),
      seedDerivationVersion: parseString(
        randomness.seedDerivationVersion,
        "randomness.seedDerivationVersion",
      ),
    },
    openingBook: parseDisabledPolicy(root.openingBook, "openingBook"),
    runtime: {
      target: parseString(runtime.target, "runtime.target"),
      adapterVersion: parseString(
        runtime.adapterVersion,
        "runtime.adapterVersion",
      ),
    },
  }

  validateOpponentPolicy(policy)
  return policy
}

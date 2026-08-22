import { describe, expect, it } from "vitest"
import fingerprintOpponentPolicy, {
  OPPONENT_POLICY_SCHEMA_VERSION,
  parseSha256Hex,
  serializeOpponentPolicy,
  type OpponentPolicy,
} from "./opponentPolicy"

const HASH_A = parseSha256Hex("a".repeat(64))
const HASH_B = parseSha256Hex("b".repeat(64))
const HASH_C = parseSha256Hex("c".repeat(64))
const HASH_D = parseSha256Hex("d".repeat(64))

const BASE_POLICY: OpponentPolicy = {
  schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
  variant: "standard",
  engine: {
    name: "stockfish",
    version: "18",
    releaseTag: "sf_18",
    sourceRevision: "1".repeat(40),
    archiveSha256: HASH_A,
    executableSha256: HASH_B,
    networks: {
      big: { fileName: "nn-cccccccccccc.nnue", sha256: HASH_C },
      small: { fileName: "nn-dddddddddddd.nnue", sha256: HASH_D },
    },
  },
  search: {
    strength: { kind: "uci-elo", elo: 1320 },
    nodeLimit: 50_000,
    threads: 1,
    hashMegabytes: 16,
    multiPv: 1,
    ponder: false,
    commandProtocolVersion: "mapachess-uci-nodes/v1",
    tablebases: { kind: "disabled" },
  },
  moveSelection: {
    kind: "best-or-uniform-random-legal",
    randomMoveProbabilityBasisPoints: 2_500,
    algorithmVersion: "best-or-uniform-random-legal/v1",
    legalMoveGeneratorVersion: "chess-rules/v1",
  },
  randomness: {
    algorithmVersion: "mapachess-prng/v1",
    seedDerivationVersion: "mapachess-seed/v1",
  },
  openingBook: { kind: "disabled" },
  runtime: {
    target: "node-wasm-x64",
    adapterVersion: "stockfish-adapter/v1",
  },
}

function policyWith(overrides: object): OpponentPolicy {
  return { ...BASE_POLICY, ...overrides } as OpponentPolicy
}

describe("opponent policy fingerprint", () => {
  it("serializes and fingerprints the same policy deterministically", () => {
    const equivalentPolicy: OpponentPolicy = {
      runtime: {
        adapterVersion: BASE_POLICY.runtime.adapterVersion,
        target: BASE_POLICY.runtime.target,
      },
      openingBook: { kind: "disabled" },
      randomness: {
        seedDerivationVersion: BASE_POLICY.randomness.seedDerivationVersion,
        algorithmVersion: BASE_POLICY.randomness.algorithmVersion,
      },
      moveSelection: {
        legalMoveGeneratorVersion:
          BASE_POLICY.moveSelection.legalMoveGeneratorVersion,
        algorithmVersion: BASE_POLICY.moveSelection.algorithmVersion,
        randomMoveProbabilityBasisPoints:
          BASE_POLICY.moveSelection.randomMoveProbabilityBasisPoints,
        kind: "best-or-uniform-random-legal",
      },
      search: {
        tablebases: { kind: "disabled" },
        commandProtocolVersion: BASE_POLICY.search.commandProtocolVersion,
        ponder: BASE_POLICY.search.ponder,
        multiPv: BASE_POLICY.search.multiPv,
        hashMegabytes: BASE_POLICY.search.hashMegabytes,
        threads: BASE_POLICY.search.threads,
        nodeLimit: BASE_POLICY.search.nodeLimit,
        strength: { elo: 1320, kind: "uci-elo" },
      },
      engine: {
        networks: {
          small: {
            sha256: BASE_POLICY.engine.networks.small.sha256,
            fileName: BASE_POLICY.engine.networks.small.fileName,
          },
          big: {
            sha256: BASE_POLICY.engine.networks.big.sha256,
            fileName: BASE_POLICY.engine.networks.big.fileName,
          },
        },
        executableSha256: BASE_POLICY.engine.executableSha256,
        archiveSha256: BASE_POLICY.engine.archiveSha256,
        sourceRevision: BASE_POLICY.engine.sourceRevision,
        releaseTag: BASE_POLICY.engine.releaseTag,
        version: BASE_POLICY.engine.version,
        name: "stockfish",
      },
      variant: "standard",
      schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    }

    expect(serializeOpponentPolicy(equivalentPolicy)).toBe(
      serializeOpponentPolicy(BASE_POLICY),
    )
    expect(fingerprintOpponentPolicy(equivalentPolicy)).toBe(
      fingerprintOpponentPolicy(BASE_POLICY),
    )
    expect(fingerprintOpponentPolicy(BASE_POLICY)).toBe(
      "sha256:5e8247be73ed409fe66b6e3e52caabd5164a0107f832a647a21632a62d444adb",
    )
  })

  it.each([
    ["variant", policyWith({ variant: "chess960" })],
    [
      "engine version",
      policyWith({
        engine: { ...BASE_POLICY.engine, version: "Stockfish 18" },
      }),
    ],
    [
      "engine source revision",
      policyWith({
        engine: {
          ...BASE_POLICY.engine,
          sourceRevision: "2".repeat(40),
        },
      }),
    ],
    [
      "engine release tag",
      policyWith({
        engine: { ...BASE_POLICY.engine, releaseTag: "sf_18.1" },
      }),
    ],
    [
      "engine archive",
      policyWith({
        engine: { ...BASE_POLICY.engine, archiveSha256: HASH_B },
      }),
    ],
    [
      "engine executable",
      policyWith({
        engine: { ...BASE_POLICY.engine, executableSha256: HASH_A },
      }),
    ],
    [
      "NNUE network",
      policyWith({
        engine: {
          ...BASE_POLICY.engine,
          networks: {
            ...BASE_POLICY.engine.networks,
            big: { fileName: "nn-aaaaaaaaaaaa.nnue", sha256: HASH_A },
          },
        },
      }),
    ],
    [
      "small NNUE network",
      policyWith({
        engine: {
          ...BASE_POLICY.engine,
          networks: {
            ...BASE_POLICY.engine.networks,
            small: { fileName: "nn-aaaaaaaaaaaa.nnue", sha256: HASH_A },
          },
        },
      }),
    ],
    [
      "UCI strength",
      policyWith({
        search: { ...BASE_POLICY.search, strength: { kind: "full-strength" } },
      }),
    ],
    [
      "UCI Elo",
      policyWith({
        search: {
          ...BASE_POLICY.search,
          strength: { kind: "uci-elo", elo: 1321 },
        },
      }),
    ],
    [
      "node limit",
      policyWith({ search: { ...BASE_POLICY.search, nodeLimit: 50_001 } }),
    ],
    ["threads", policyWith({ search: { ...BASE_POLICY.search, threads: 2 } })],
    [
      "hash memory",
      policyWith({ search: { ...BASE_POLICY.search, hashMegabytes: 32 } }),
    ],
    ["MultiPV", policyWith({ search: { ...BASE_POLICY.search, multiPv: 2 } })],
    [
      "pondering",
      policyWith({ search: { ...BASE_POLICY.search, ponder: true } }),
    ],
    [
      "command protocol",
      policyWith({
        search: {
          ...BASE_POLICY.search,
          commandProtocolVersion: "mapachess-uci-nodes/v2",
        },
      }),
    ],
    [
      "random-move probability",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          randomMoveProbabilityBasisPoints: 2_501,
        },
      }),
    ],
    [
      "move-selection algorithm",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          algorithmVersion: "best-or-uniform-random-legal/v2",
        },
      }),
    ],
    [
      "legal-move generator",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          legalMoveGeneratorVersion: "chess-rules/v2",
        },
      }),
    ],
    [
      "random algorithm",
      policyWith({
        randomness: {
          ...BASE_POLICY.randomness,
          algorithmVersion: "mapachess-prng/v2",
        },
      }),
    ],
    [
      "seed derivation",
      policyWith({
        randomness: {
          ...BASE_POLICY.randomness,
          seedDerivationVersion: "mapachess-seed/v2",
        },
      }),
    ],
    [
      "runtime target",
      policyWith({
        runtime: { ...BASE_POLICY.runtime, target: "browser-wasm-x64" },
      }),
    ],
    [
      "runtime adapter",
      policyWith({
        runtime: {
          ...BASE_POLICY.runtime,
          adapterVersion: "stockfish-adapter/v2",
        },
      }),
    ],
  ])("changes when the %s changes", (_label, changedPolicy) => {
    expect(fingerprintOpponentPolicy(changedPolicy)).not.toBe(
      fingerprintOpponentPolicy(BASE_POLICY),
    )
  })

  it.each([
    ["schema version", policyWith({ schemaVersion: 1 })],
    ["variant", policyWith({ variant: "antichess" })],
    [
      "engine name",
      policyWith({ engine: { ...BASE_POLICY.engine, name: "not-stockfish" } }),
    ],
    [
      "empty engine version",
      policyWith({ engine: { ...BASE_POLICY.engine, version: "" } }),
    ],
    [
      "padded source revision",
      policyWith({
        engine: { ...BASE_POLICY.engine, sourceRevision: " revision " },
      }),
    ],
    [
      "control character",
      policyWith({
        engine: { ...BASE_POLICY.engine, sourceRevision: "revision\n2" },
      }),
    ],
    [
      "archive hash",
      policyWith({
        engine: { ...BASE_POLICY.engine, archiveSha256: "A".repeat(64) },
      }),
    ],
    [
      "executable hash",
      policyWith({
        engine: { ...BASE_POLICY.engine, executableSha256: "abc" },
      }),
    ],
    [
      "network filename",
      policyWith({
        engine: {
          ...BASE_POLICY.engine,
          networks: {
            ...BASE_POLICY.engine.networks,
            big: { ...BASE_POLICY.engine.networks.big, fileName: "wrong" },
          },
        },
      }),
    ],
    [
      "strength kind",
      policyWith({
        search: { ...BASE_POLICY.search, strength: { kind: "skill-level" } },
      }),
    ],
    [
      "UCI Elo",
      policyWith({
        search: {
          ...BASE_POLICY.search,
          strength: { kind: "uci-elo", elo: 0 },
        },
      }),
    ],
    [
      "node limit",
      policyWith({ search: { ...BASE_POLICY.search, nodeLimit: 0 } }),
    ],
    [
      "threads",
      policyWith({ search: { ...BASE_POLICY.search, threads: 1.5 } }),
    ],
    [
      "hash memory",
      policyWith({ search: { ...BASE_POLICY.search, hashMegabytes: NaN } }),
    ],
    [
      "MultiPV",
      policyWith({ search: { ...BASE_POLICY.search, multiPv: Infinity } }),
    ],
    [
      "pondering",
      policyWith({ search: { ...BASE_POLICY.search, ponder: "false" } }),
    ],
    [
      "command protocol",
      policyWith({
        search: { ...BASE_POLICY.search, commandProtocolVersion: "" },
      }),
    ],
    [
      "tablebase kind",
      policyWith({
        search: {
          ...BASE_POLICY.search,
          tablebases: { kind: "unknown" },
        },
      }),
    ],
    [
      "move-selection kind",
      policyWith({
        moveSelection: { ...BASE_POLICY.moveSelection, kind: "top-two" },
      }),
    ],
    [
      "negative random probability",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          randomMoveProbabilityBasisPoints: -1,
        },
      }),
    ],
    [
      "fractional random probability",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          randomMoveProbabilityBasisPoints: 0.5,
        },
      }),
    ],
    [
      "excess random probability",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          randomMoveProbabilityBasisPoints: 10_001,
        },
      }),
    ],
    [
      "move algorithm",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          algorithmVersion: " ",
        },
      }),
    ],
    [
      "legal-move generator",
      policyWith({
        moveSelection: {
          ...BASE_POLICY.moveSelection,
          legalMoveGeneratorVersion: "",
        },
      }),
    ],
    [
      "random algorithm",
      policyWith({
        randomness: { ...BASE_POLICY.randomness, algorithmVersion: "" },
      }),
    ],
    [
      "seed derivation",
      policyWith({
        randomness: { ...BASE_POLICY.randomness, seedDerivationVersion: "" },
      }),
    ],
    ["opening-book kind", policyWith({ openingBook: { kind: "unknown" } })],
    [
      "runtime target",
      policyWith({ runtime: { ...BASE_POLICY.runtime, target: "" } }),
    ],
    [
      "runtime adapter",
      policyWith({ runtime: { ...BASE_POLICY.runtime, adapterVersion: "" } }),
    ],
  ])("rejects an invalid %s", (_label, invalidPolicy) => {
    expect(() =>
      fingerprintOpponentPolicy(invalidPolicy as OpponentPolicy),
    ).toThrow(TypeError)
  })
})

describe("SHA-256 parser", () => {
  it("returns a valid lowercase digest", () => {
    expect(parseSha256Hex("d".repeat(64))).toBe("d".repeat(64))
  })

  it("uses the supplied label for invalid input", () => {
    expect(() => parseSha256Hex("invalid", "engine digest")).toThrow(
      "engine digest must be exactly 64 lowercase hexadecimal characters.",
    )
  })
})

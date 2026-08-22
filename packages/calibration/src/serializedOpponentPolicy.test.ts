import { describe, expect, it } from "vitest"
import { createStockfish18BuildIdentity } from "@mapachess/stockfish/build-identity"
import { STOCKFISH_PROCESS_ADAPTER_VERSION } from "@mapachess/stockfish/uci-process-adapter"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "./deterministicRandom"
import {
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  serializeOpponentPolicy,
  type OpponentPolicy,
} from "./opponentPolicy"
import parseSerializedOpponentPolicy from "./serializedOpponentPolicy"

const POLICY: OpponentPolicy = {
  schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
  variant: "standard",
  engine: createStockfish18BuildIdentity("windows-x64"),
  search: {
    strength: { kind: "uci-elo", elo: 1320 },
    nodeLimit: 1_000,
    threads: 1,
    hashMegabytes: 16,
    multiPv: 1,
    ponder: false,
    commandProtocolVersion: CALIBRATION_COMMAND_PROTOCOL_VERSION,
    tablebases: { kind: "disabled" },
  },
  moveSelection: {
    kind: "best-or-uniform-random-legal",
    randomMoveProbabilityBasisPoints: 0,
    algorithmVersion: CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
    legalMoveGeneratorVersion: CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  },
  randomness: {
    algorithmVersion: CALIBRATION_RANDOM_ALGORITHM_VERSION,
    seedDerivationVersion: CALIBRATION_SEED_DERIVATION_VERSION,
  },
  openingBook: { kind: "disabled" },
  runtime: {
    target: "windows-x64",
    adapterVersion: STOCKFISH_PROCESS_ADAPTER_VERSION,
  },
}
const SERIALIZED_POLICY = serializeOpponentPolicy(POLICY)

describe("serialized opponent policy", () => {
  it("strictly recreates a canonical policy record", () => {
    expect(parseSerializedOpponentPolicy(SERIALIZED_POLICY)).toEqual(POLICY)
  })

  it("parses the exact full-strength union without inventing an Elo field", () => {
    const fullStrengthPolicy: OpponentPolicy = {
      ...POLICY,
      search: { ...POLICY.search, strength: { kind: "full-strength" } },
    }

    expect(
      parseSerializedOpponentPolicy(serializeOpponentPolicy(fullStrengthPolicy))
        .search.strength,
    ).toEqual({ kind: "full-strength" })
  })

  it.each([
    ["invalid JSON", "{"],
    [
      "unknown root key",
      SERIALIZED_POLICY.replace(/}$/, ',"unexpected":true}'),
    ],
    [
      "wrong numeric type",
      SERIALIZED_POLICY.replace('"nodeLimit":1000', '"nodeLimit":"1000"'),
    ],
  ])("rejects %s", (_label, serializedPolicy) => {
    expect(() => parseSerializedOpponentPolicy(serializedPolicy)).toThrow(
      TypeError,
    )
  })
})

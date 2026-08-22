import { resolve } from "node:path"
import { Chess } from "chess.js"
import { beforeAll, describe, expect, it } from "vitest"
import provisionStockfish18, {
  type ProvisionedStockfish,
} from "@mapachess/stockfish/provision"
import {
  createProvisionedStockfishProcessAdapter,
  STOCKFISH_PROCESS_ADAPTER_VERSION,
} from "@mapachess/stockfish/uci-process-adapter"
import { executeCalibrationPair } from "./calibrationGameExecutor"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
} from "./calibrationPlan"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "./deterministicRandom"
import {
  CALIBRATION_COMMAND_PROTOCOL_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  type OpponentPolicy,
} from "./opponentPolicy"

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..")
const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const MATE_IN_ONE_FEN = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"

let provisioned: ProvisionedStockfish

beforeAll(async () => {
  provisioned = await provisionStockfish18(WORKSPACE_ROOT)
})

function createPolicy(nodeLimit: number): OpponentPolicy {
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant: "standard",
    engine: provisioned.identity,
    search: {
      strength: { kind: "full-strength" },
      nodeLimit,
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
      target: provisioned.target,
      adapterVersion: STOCKFISH_PROCESS_ADAPTER_VERSION,
    },
  }
}

describe("pinned Stockfish calibration integration", () => {
  it("returns an owned legal move from the stochastic UCI_Elo anchor", async () => {
    const chess = new Chess(STANDARD_START_FEN)
    const legalMoves = chess.moves({ verbose: true }).map((move) => move.lan)
    const adapter = createProvisionedStockfishProcessAdapter(provisioned, {
      variant: "standard",
      strength: { kind: "uci-elo", elo: 1320 },
      threads: 1,
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
    })

    try {
      const identity = await adapter.boot()
      const result = await adapter.search({
        requestId: "real-uci-elo-anchor/legal-move",
        nodeLimit: 1_000,
        position: { fen: STANDARD_START_FEN, moves: [] },
      })

      expect(identity.name).toBe("Stockfish 18")
      expect(result.requestId).toBe("real-uci-elo-anchor/legal-move")
      expect(result.bestMove).not.toBeNull()
      expect(legalMoves).toContain(result.bestMove)
      expect(result.latestInformation?.nodes).toBeGreaterThanOrEqual(1_000)
    } finally {
      await adapter.close()
    }
  })

  it("executes a real color-reversed Standard mate-in-one pair", async () => {
    const plan = createCalibrationPlan({
      schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
      seed: 42,
      variant: "standard",
      openings: [{ id: "mate-in-one", fen: MATE_IN_ONE_FEN }],
      edges: [
        {
          id: "real-engine-smoke",
          pairsPerOpening: 1,
          policyA: createPolicy(1_000),
          policyB: createPolicy(2_000),
        },
      ],
    })
    const pair = await executeCalibrationPair({
      games: plan.games,
      policies: plan.policies,
      maxPlies: 2,
      createEngine: ({ configuration, policy }) => {
        expect(policy.engine).toEqual(provisioned.identity)
        expect(policy.runtime.target).toBe(provisioned.target)
        return createProvisionedStockfishProcessAdapter(
          provisioned,
          configuration,
        )
      },
    })

    expect(pair.games.map((game) => game.status)).toEqual([
      "completed",
      "completed",
    ])
    expect(pair.games.map((game) => game.moves[0]?.uci)).toEqual([
      "g6g7",
      "g6g7",
    ])
    expect(
      pair.games.map((game) =>
        game.status === "completed" ? game.termination : undefined,
      ),
    ).toEqual([
      { kind: "checkmate", winner: "white" },
      { kind: "checkmate", winner: "white" },
    ])
  })
})

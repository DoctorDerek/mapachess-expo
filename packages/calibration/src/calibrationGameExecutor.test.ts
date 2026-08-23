import { describe, expect, it } from "vitest"
import { createStockfish18BuildIdentity } from "@mapachess/stockfish/build-identity"
import {
  STOCKFISH_PROCESS_ADAPTER_VERSION,
  type StockfishProcessAdapter,
  type StockfishProcessState,
  type StockfishSearchRequest,
  type StockfishSearchResult,
  type StockfishUciIdentity,
} from "@mapachess/stockfish/uci-process-adapter"
import executeCalibrationGame, {
  executeCalibrationPair,
  type OpenCalibrationEngine,
} from "./calibrationGameExecutor"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
  type CalibrationPlan,
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
  type CalibrationVariant,
  type OpponentPolicy,
} from "./opponentPolicy"

const MATE_IN_ONE_FEN = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"
const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

function createPolicy(
  strength: OpponentPolicy["search"]["strength"],
  randomMoveProbabilityBasisPoints: number,
  variant: CalibrationVariant = "standard",
): OpponentPolicy {
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant,
    engine: createStockfish18BuildIdentity("windows-x64"),
    search: {
      strength,
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
      randomMoveProbabilityBasisPoints,
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
}

function createPlan(
  fen: string,
  randomMoveProbabilityBasisPoints = 0,
  variant: CalibrationVariant = "standard",
): CalibrationPlan {
  return createCalibrationPlan({
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    seed: 42,
    variant,
    openings: [{ id: "fixture", fen }],
    edges: [
      {
        id: "fixture-edge",
        pairsPerOpening: 1,
        policyA: createPolicy(
          { kind: "full-strength" },
          randomMoveProbabilityBasisPoints,
          variant,
        ),
        policyB: createPolicy(
          { kind: "uci-elo", elo: 1320 },
          randomMoveProbabilityBasisPoints,
          variant,
        ),
      },
    ],
  })
}

class FakeEngine implements StockfishProcessAdapter {
  public readonly searches: StockfishSearchRequest[] = []
  public processState: StockfishProcessState = "created"

  public constructor(private readonly bestMove: string | null) {}

  public async boot(): Promise<StockfishUciIdentity> {
    this.processState = "ready"
    return { name: "Stockfish 18", author: "fixture", optionNames: [] }
  }

  public async close(): Promise<void> {
    this.processState = "closed"
  }

  public async search(
    request: StockfishSearchRequest,
  ): Promise<StockfishSearchResult> {
    this.searches.push(request)
    return {
      requestId: request.requestId,
      bestMove: this.bestMove,
      informationLineCount: 0,
    }
  }

  public state(): StockfishProcessState {
    return this.processState
  }
}

function openFakeEngine(
  bestMove: string | null,
  engines: FakeEngine[],
): OpenCalibrationEngine {
  return () => {
    const engine = new FakeEngine(bestMove)
    engines.push(engine)
    return engine
  }
}

describe("Standard calibration game execution", () => {
  it("executes and closes both games in a color-reversed mate-in-one pair", async () => {
    const plan = createPlan(MATE_IN_ONE_FEN)
    const engines: FakeEngine[] = []
    const pair = await executeCalibrationPair({
      games: plan.games,
      policies: plan.policies,
      maxPlies: 10,
      openEngine: openFakeEngine("g6g7", engines),
    })

    expect(pair.games).toHaveLength(2)
    expect(pair.games.map((game) => game.status)).toEqual([
      "completed",
      "completed",
    ])
    expect(
      pair.games.map((game) =>
        game.status === "completed" ? game.termination : undefined,
      ),
    ).toEqual([
      { kind: "checkmate", winner: "white" },
      { kind: "checkmate", winner: "white" },
    ])
    expect(pair.games.map((game) => game.moves[0]?.uci)).toEqual([
      "g6g7",
      "g6g7",
    ])
    expect(engines).toHaveLength(4)
    expect(engines.every((engine) => engine.state() === "closed")).toBe(true)
  })

  it("replays a seeded uniform legal move without asking Stockfish", async () => {
    const plan = createPlan(STANDARD_START_FEN, 10_000)
    const firstEngines: FakeEngine[] = []
    const secondEngines: FakeEngine[] = []
    const game = plan.games[0]
    expect(game).toBeDefined()
    if (game === undefined) return

    const first = await executeCalibrationGame({
      game,
      policies: plan.policies,
      maxPlies: 1,
      openEngine: openFakeEngine(null, firstEngines),
    })
    const second = await executeCalibrationGame({
      game,
      policies: plan.policies,
      maxPlies: 1,
      openEngine: openFakeEngine(null, secondEngines),
    })

    expect(first).toEqual(second)
    expect(first.status).toBe("unterminated")
    expect(first.moves[0]?.source).toBe("uniform-random-legal")
    expect(
      [...firstEngines, ...secondEngines].every(
        (engine) => engine.searches.length === 0,
      ),
    ).toBe(true)
  })

  it("rejects an illegal engine move and still closes both seats", async () => {
    const plan = createPlan(MATE_IN_ONE_FEN)
    const engines: FakeEngine[] = []
    const game = plan.games[0]
    expect(game).toBeDefined()
    if (game === undefined) return

    await expect(
      executeCalibrationGame({
        game,
        policies: plan.policies,
        maxPlies: 10,
        openEngine: openFakeEngine("a1a8", engines),
      }),
    ).rejects.toThrow("Stockfish returned an illegal move")
    expect(engines.every((engine) => engine.state() === "closed")).toBe(true)
  })

  it("classifies an initially terminal Standard position without engines", async () => {
    const plan = createPlan("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")
    const game = plan.games[0]
    let openEngineCalls = 0
    expect(game).toBeDefined()
    if (game === undefined) return

    const result = await executeCalibrationGame({
      game,
      policies: plan.policies,
      maxPlies: 10,
      openEngine: () => {
        openEngineCalls += 1
        return new FakeEngine(null)
      },
    })

    expect(result).toMatchObject({
      status: "completed",
      termination: { kind: "stalemate" },
      moves: [],
    })
    expect(openEngineCalls).toBe(0)
  })

  it("rejects Chess960 before creating an engine", async () => {
    const plan = createPlan(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1",
      0,
      "chess960",
    )
    const game = plan.games[0]
    let openEngineCalls = 0
    expect(game).toBeDefined()
    if (game === undefined) return

    await expect(
      executeCalibrationGame({
        game,
        policies: plan.policies,
        maxPlies: 10,
        openEngine: () => {
          openEngineCalls += 1
          return new FakeEngine(null)
        },
      }),
    ).rejects.toThrow("Chess960 calibration execution is unavailable")
    expect(openEngineCalls).toBe(0)
  })

  it("rejects a tampered policy record before creating an engine", async () => {
    const plan = createPlan(MATE_IN_ONE_FEN)
    const game = plan.games[0]
    const firstPolicy = plan.policies[0]
    let openEngineCalls = 0
    expect(game).toBeDefined()
    expect(firstPolicy).toBeDefined()
    if (game === undefined || firstPolicy === undefined) return

    const policies = [
      {
        ...firstPolicy,
        policy: {
          ...firstPolicy.policy,
          search: {
            ...firstPolicy.policy.search,
            nodeLimit: firstPolicy.policy.search.nodeLimit + 1,
          },
        },
      },
      ...plan.policies.slice(1),
    ]

    await expect(
      executeCalibrationGame({
        game,
        policies,
        maxPlies: 10,
        openEngine: () => {
          openEngineCalls += 1
          return new FakeEngine(null)
        },
      }),
    ).rejects.toThrow("does not match its policy")
    expect(openEngineCalls).toBe(0)
  })

  it("rejects a pair that does not reverse policy seats", async () => {
    const plan = createPlan(MATE_IN_ONE_FEN)
    const firstGame = plan.games[0]
    let openEngineCalls = 0
    expect(firstGame).toBeDefined()
    if (firstGame === undefined) return

    await expect(
      executeCalibrationPair({
        games: [firstGame, firstGame],
        policies: plan.policies,
        maxPlies: 10,
        openEngine: () => {
          openEngineCalls += 1
          return new FakeEngine(null)
        },
      }),
    ).rejects.toThrow(
      "must preserve the same start and reverse both policy seats",
    )
    expect(openEngineCalls).toBe(0)
  })
})

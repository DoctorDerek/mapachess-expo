import { describe, expect, it } from "vitest"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
  type CalibrationEdge,
  type CalibrationOpening,
  type CalibrationPlanInput,
} from "./calibrationPlan"
import {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
} from "./deterministicRandom"
import {
  OPPONENT_POLICY_SCHEMA_VERSION,
  parseSha256Hex,
  type CalibrationVariant,
  type OpponentPolicy,
} from "./opponentPolicy"

const HASH_A = parseSha256Hex("a".repeat(64))
const HASH_B = parseSha256Hex("b".repeat(64))
const HASH_C = parseSha256Hex("c".repeat(64))
const HASH_D = parseSha256Hex("d".repeat(64))

function createPolicy(
  randomMoveProbabilityBasisPoints: number,
  variant: CalibrationVariant = "standard",
): OpponentPolicy {
  return {
    schemaVersion: OPPONENT_POLICY_SCHEMA_VERSION,
    variant,
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
      randomMoveProbabilityBasisPoints,
      algorithmVersion: "best-or-uniform-random-legal/v1",
      legalMoveGeneratorVersion: "chess-rules/v1",
    },
    randomness: {
      algorithmVersion: CALIBRATION_RANDOM_ALGORITHM_VERSION,
      seedDerivationVersion: CALIBRATION_SEED_DERIVATION_VERSION,
    },
    openingBook: { kind: "disabled" },
    runtime: {
      target: "node-wasm-x64",
      adapterVersion: "stockfish-adapter/v1",
    },
  }
}

const POLICY_A = createPolicy(2_500)
const POLICY_B = createPolicy(5_000)
const OPENING_A: CalibrationOpening = {
  id: "standard-start",
  fen: "rn1qkbnr/ppp1pppp/3p4/8/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
}
const OPENING_B: CalibrationOpening = {
  id: "queen-pawn",
  fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
}
const BASE_EDGE: CalibrationEdge = {
  id: "low-neighbor",
  pairsPerOpening: 2,
  policyA: POLICY_A,
  policyB: POLICY_B,
}

const BASE_INPUT: CalibrationPlanInput = {
  schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
  seed: 42,
  variant: "standard",
  openings: [OPENING_A, OPENING_B],
  edges: [BASE_EDGE],
}

function inputWith(overrides: object): CalibrationPlanInput {
  return { ...BASE_INPUT, ...overrides } as CalibrationPlanInput
}

describe("calibration plan", () => {
  it("replays the same immutable plan from equivalent unordered input", () => {
    const sourceBefore = structuredClone(BASE_INPUT)
    const reorderedInput: CalibrationPlanInput = {
      ...BASE_INPUT,
      openings: [...BASE_INPUT.openings].reverse(),
      edges: BASE_INPUT.edges.map((edge) => ({
        ...edge,
        policyA: edge.policyB,
        policyB: edge.policyA,
      })),
    }

    const plan = createCalibrationPlan(BASE_INPUT)
    const replay = createCalibrationPlan(reorderedInput)

    expect(plan).toEqual(replay)
    expect(BASE_INPUT).toEqual(sourceBefore)
    expect(plan.planId).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(plan.games).toHaveLength(8)
    expect(plan.policies).toHaveLength(2)
  })

  it("creates identical starts, reversed colors, and stable policy seeds per pair", () => {
    const plan = createCalibrationPlan(BASE_INPUT)
    const gamesByPair = Map.groupBy(plan.games, (game) => game.pairId)

    expect(gamesByPair.size).toBe(4)

    for (const games of gamesByPair.values()) {
      expect(games).toHaveLength(2)
      const [firstGame, secondGame] = games

      expect(firstGame).toBeDefined()
      expect(secondGame).toBeDefined()

      if (firstGame === undefined || secondGame === undefined) continue

      expect(firstGame.gameInPair).toBe(1)
      expect(secondGame.gameInPair).toBe(2)
      expect(firstGame.fen).toBe(secondGame.fen)
      expect(firstGame.openingId).toBe(secondGame.openingId)
      expect(firstGame.white.policyFingerprint).toBe(
        secondGame.black.policyFingerprint,
      )
      expect(firstGame.black.policyFingerprint).toBe(
        secondGame.white.policyFingerprint,
      )
      expect(firstGame.white.randomSeed).toBe(secondGame.black.randomSeed)
      expect(firstGame.black.randomSeed).toBe(secondGame.white.randomSeed)
    }
  })

  it("changes plan identity, order, and game seeds when the root seed changes", () => {
    const firstPlan = createCalibrationPlan(BASE_INPUT)
    const secondPlan = createCalibrationPlan(inputWith({ seed: 43 }))

    expect(secondPlan.planId).not.toBe(firstPlan.planId)
    expect(secondPlan.games).not.toEqual(firstPlan.games)
  })

  it("changes plan identity when a strength-bearing policy changes", () => {
    const changedPlan = createCalibrationPlan(
      inputWith({
        edges: [
          {
            ...BASE_EDGE,
            policyB: createPolicy(5_001),
          },
        ],
      }),
    )

    expect(changedPlan.planId).not.toBe(
      createCalibrationPlan(BASE_INPUT).planId,
    )
  })

  it("sorts multiple edge identities and deduplicates shared policies", () => {
    const policyC = {
      ...createPolicy(7_500),
      engine: {
        ...POLICY_A.engine,
        executableSha256: HASH_C,
      },
    }
    const plan = createCalibrationPlan(
      inputWith({
        openings: [OPENING_A],
        edges: [
          {
            id: "z-edge",
            pairsPerOpening: 1,
            policyA: POLICY_B,
            policyB: policyC,
          },
          {
            id: "a-edge",
            pairsPerOpening: 1,
            policyA: POLICY_A,
            policyB: POLICY_B,
          },
        ],
      }),
    )

    expect(plan.games).toHaveLength(4)
    expect(plan.policies).toHaveLength(3)
    expect(plan.policies.map((policy) => policy.fingerprint)).toEqual(
      [...plan.policies.map((policy) => policy.fingerprint)].sort(),
    )
  })

  it("keeps Chess960 plans in a distinct reproducible pool", () => {
    const chess960Plan = createCalibrationPlan({
      ...BASE_INPUT,
      variant: "chess960",
      openings: [
        {
          id: "chess960-518",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1",
        },
      ],
      edges: [
        {
          ...BASE_EDGE,
          policyA: createPolicy(2_500, "chess960"),
          policyB: createPolicy(5_000, "chess960"),
        },
      ],
    })

    expect(chess960Plan.variant).toBe("chess960")
    expect(chess960Plan.games).toHaveLength(4)
    expect(chess960Plan.planId).not.toBe(
      createCalibrationPlan(BASE_INPUT).planId,
    )
  })

  it.each([
    ["schema version", inputWith({ schemaVersion: 2 })],
    ["variant", inputWith({ variant: "antichess" })],
    ["seed", inputWith({ seed: -1 })],
    ["missing openings", inputWith({ openings: [] })],
    ["opening id", inputWith({ openings: [{ id: "", fen: OPENING_A.fen }] })],
    ["opening FEN", inputWith({ openings: [{ id: "opening", fen: " bad " }] })],
    [
      "duplicate opening ids",
      inputWith({
        openings: [OPENING_A, OPENING_A],
      }),
    ],
    ["missing edges", inputWith({ edges: [] })],
    ["edge id", inputWith({ edges: [{ ...BASE_EDGE, id: "" }] })],
    [
      "pair count",
      inputWith({
        edges: [{ ...BASE_EDGE, pairsPerOpening: 0 }],
      }),
    ],
    ["duplicate edge ids", inputWith({ edges: [BASE_EDGE, BASE_EDGE] })],
    [
      "variant mismatch",
      inputWith({
        edges: [
          {
            ...BASE_EDGE,
            policyB: createPolicy(5_000, "chess960"),
          },
        ],
      }),
    ],
    [
      "identical policies",
      inputWith({
        edges: [
          {
            ...BASE_EDGE,
            policyB: POLICY_A,
          },
        ],
      }),
    ],
    [
      "unsafe game count",
      inputWith({
        openings: [OPENING_A, OPENING_B],
        edges: [
          {
            ...BASE_EDGE,
            pairsPerOpening: Number.MAX_SAFE_INTEGER,
          },
        ],
      }),
    ],
    [
      "unsafe accumulated pair count",
      inputWith({
        openings: [OPENING_A],
        edges: [
          {
            ...BASE_EDGE,
            id: "edge-a",
            pairsPerOpening: 5_000_000_000_000_000,
          },
          {
            ...BASE_EDGE,
            id: "edge-b",
            pairsPerOpening: 5_000_000_000_000_000,
          },
        ],
      }),
    ],
    [
      "unsafe color-reversed game count",
      inputWith({
        openings: [OPENING_A],
        edges: [
          {
            ...BASE_EDGE,
            pairsPerOpening: 5_000_000_000_000_000,
          },
        ],
      }),
    ],
  ])("rejects an invalid %s", (_label, invalidInput) => {
    expect(() => createCalibrationPlan(invalidInput)).toThrow(TypeError)
  })
})

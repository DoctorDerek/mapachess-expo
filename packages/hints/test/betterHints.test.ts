import { describe, expect, it } from "vitest"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSearchResult,
  type StockfishEngineSession,
  type StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import createBetterHintsAnalyst, {
  BETTER_HINTS_NODE_LIMIT,
  BetterHintsAnalysisError,
} from "../src/betterHints"

const STANDARD_STARTING_POSITION: MatchStartingPosition = {
  chess960PositionId: null,
  variant: "standard",
}

const requirePosition = (fen: string): MatchPosition => {
  const result = reconstructMatchPosition(STANDARD_STARTING_POSITION, fen)
  if (!result.ok) throw new Error(`Invalid Better Hints test FEN: ${fen}`)
  return result.position
}

const rankedResult = (
  requestId: string,
  moves: readonly string[],
): StockfishEngineSearchResult => ({
  bestMove: moves[0] ?? null,
  principalVariations: moves.map((move, index) => ({
    moves: [move],
    rank: index + 1,
    score: { bound: "exact", kind: "centipawns", value: 10 - index },
  })),
  requestId,
})

type SearchHandler = (
  request: StockfishSearchRequest,
  signal?: AbortSignal,
) => Promise<StockfishEngineSearchResult>

const createEngine = (search: SearchHandler): StockfishEngineSession => ({
  boot: () => Promise.resolve({ author: "fixture", name: "fixture" }),
  close: () => Promise.resolve(),
  search,
  state: () => "ready",
})

describe("Better Hints analysis", () => {
  it("selects three ranked distinct legal pieces for Player and Opponent", async () => {
    const position = createInitialMatchPosition(STANDARD_STARTING_POSITION)
    const requests: StockfishSearchRequest[] = []
    const engine = createEngine((request) => {
      requests.push(request)
      return Promise.resolve(
        rankedResult(
          request.requestId,
          requests.length === 1
            ? ["e2e4", "e2e3", "g1f3", "d2d4", "b1c3"]
            : ["e7e5", "e7e6", "g8f6", "d7d5", "b8c6"],
        ),
      )
    })
    const analyst = createBetterHintsAnalyst({ engine })

    const result = await analyst.analyze({
      playerColor: "white",
      position,
      requestId: "match-1/hints/ply-1",
    })

    expect(result).toEqual({
      opponent: [
        { color: "black", from: "e7", to: "e5", uci: "e7e5" },
        { color: "black", from: "g8", to: "f6", uci: "g8f6" },
        { color: "black", from: "d7", to: "d5", uci: "d7d5" },
      ],
      player: [
        { color: "white", from: "e2", to: "e4", uci: "e2e4" },
        { color: "white", from: "g1", to: "f3", uci: "g1f3" },
        { color: "white", from: "d2", to: "d4", uci: "d2d4" },
      ],
      positionFen: position.fen,
      requestId: "match-1/hints/ply-1",
    })
    expect(requests).toEqual([
      {
        nodeLimit: BETTER_HINTS_NODE_LIMIT,
        position: { fen: position.fen, moves: [] },
        requestId: "match-1/hints/ply-1/player",
      },
      {
        nodeLimit: BETTER_HINTS_NODE_LIMIT,
        position: {
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
          moves: [],
        },
        requestId: "match-1/hints/ply-1/opponent",
      },
    ])
    expect(position.turn).toBe("white")
  })

  it("shows every distinct movable piece when fewer than three exist", async () => {
    const position = requirePosition("7k/8/8/8/8/8/P7/K7 w - - 0 1")
    let searchIndex = 0
    const analyst = createBetterHintsAnalyst({
      engine: createEngine((request) => {
        searchIndex += 1
        return Promise.resolve(
          rankedResult(
            request.requestId,
            searchIndex === 1 ? ["a2a3", "a1b1"] : ["h8g8"],
          ),
        )
      }),
    })

    await expect(
      analyst.analyze({
        playerColor: "white",
        position,
        requestId: "few-pieces",
      }),
    ).resolves.toMatchObject({
      opponent: [{ color: "black", from: "h8" }],
      player: [
        { color: "white", from: "a2" },
        { color: "white", from: "a1" },
      ],
    })
  })

  it("rejects an engine result that omits an available hint piece", async () => {
    const position = createInitialMatchPosition(STANDARD_STARTING_POSITION)
    const analyst = createBetterHintsAnalyst({
      engine: createEngine((request) =>
        Promise.resolve(rankedResult(request.requestId, ["e2e4", "g1f3"])),
      ),
    })

    await expect(
      analyst.analyze({
        playerColor: "white",
        position,
        requestId: "incomplete",
      }),
    ).rejects.toThrow(
      "Stockfish returned 2 distinct hint pieces; 3 are legally available.",
    )
  })

  it.each([
    {
      expected: "Stockfish returned no ranked principal variations",
      result: { bestMove: "e2e4", requestId: "invalid/player" },
    },
    {
      expected: "Stockfish returned an illegal root move",
      result: rankedResult("invalid/player", ["e2e5"]),
    },
  ])(
    "rejects invalid ranked output: $expected",
    async ({ expected, result }) => {
      const position = createInitialMatchPosition(STANDARD_STARTING_POSITION)
      const analyst = createBetterHintsAnalyst({
        engine: createEngine(() => Promise.resolve(result)),
      })

      await expect(
        analyst.analyze({
          playerColor: "white",
          position,
          requestId: "invalid",
        }),
      ).rejects.toThrow(expected)
    },
  )

  it("uses valid child positions for Opponent hints while Player is in check", async () => {
    const position = requirePosition("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1")
    const requests: StockfishSearchRequest[] = []
    const analyst = createBetterHintsAnalyst({
      engine: createEngine((request) => {
        requests.push(request)
        if (request.requestId.endsWith("/player")) {
          return Promise.resolve(rankedResult(request.requestId, ["e1e2"]))
        }

        const value = request.requestId.includes("/e2") ? -500 : -300
        return Promise.resolve({
          bestMove: null,
          latestInformation: {
            score: { bound: "exact", kind: "centipawns", value },
          },
          requestId: request.requestId,
        })
      }),
    })

    const result = await analyst.analyze({
      playerColor: "white",
      position,
      requestId: "checked",
    })

    expect(result.opponent.map((hint) => hint.from)).toEqual(["e2", "e8"])
    expect(requests.slice(1).length).toBeGreaterThan(0)
    expect(
      requests
        .slice(1)
        .every((request) => request.position.fen.split(" ")[1] === "w"),
    ).toBe(true)
    expect(
      requests
        .slice(1)
        .reduce((nodes, request) => nodes + request.nodeLimit, 0),
    ).toBeLessThanOrEqual(BETTER_HINTS_NODE_LIMIT)
    expect(
      requests.every(
        (request) =>
          !request.requestId.includes("/opponent-checked/") ||
          !request.requestId.endsWith("/e2e1"),
      ),
    ).toBe(true)
  })

  it("propagates cancellation before beginning engine work", async () => {
    const position = createInitialMatchPosition(STANDARD_STARTING_POSITION)
    const controller = new AbortController()
    controller.abort()
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(() => {
        throw new Error("Engine must not receive an aborted hint request")
      }),
    })

    await expect(
      analyst.analyze(
        {
          playerColor: "white",
          position,
          requestId: "aborted",
        },
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
  })

  it("rejects stale engine output and non-player-turn requests", async () => {
    const position = createInitialMatchPosition(STANDARD_STARTING_POSITION)
    const analyst = createBetterHintsAnalyst({
      engine: createEngine((request) =>
        Promise.resolve(rankedResult(`${request.requestId}/stale`, ["e2e4"])),
      ),
    })

    await expect(
      analyst.analyze({
        playerColor: "white",
        position,
        requestId: "stale",
      }),
    ).rejects.toBeInstanceOf(BetterHintsAnalysisError)
    await expect(
      analyst.analyze({
        playerColor: "black",
        position,
        requestId: "wrong-turn",
      }),
    ).rejects.toThrow(
      "Better Hints may only begin on the player's actual turn.",
    )
    await expect(
      analyst.analyze({
        playerColor: "black",
        position: requirePosition("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1"),
        requestId: "completed",
      }),
    ).rejects.toThrow("Better Hints require a playable match position.")
  })
})

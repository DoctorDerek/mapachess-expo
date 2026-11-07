import { describe, expect, it } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
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
  it("recognizes opponent checkmate and stalemate candidates while analyzing a checked player without spending search nodes on terminal children", async () => {
    const position = requirePosition("8/8/8/8/8/5qk1/8/7K w - - 0 1")
    const requests: StockfishSearchRequest[] = []
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(async (request) => {
        requests.push(request)
        return request.requestId.endsWith("/player")
          ? rankedResult(request.requestId, ["h1g1"])
          : {
              requestId: request.requestId,
              bestMove: null,
              latestInformation: {
                score: { kind: "centipawns", value: 0, bound: "exact" },
              },
            }
      }),
    })
    const result = await analyst.analyze({
      playerColor: "white",
      position,
      requestId: "terminal-children",
    })
    expect(requirePosition("8/8/8/8/8/6k1/8/3q3K w - - 1 2").status).toEqual({
      type: "checkmate",
      winner: "black",
    })
    expect(requirePosition("8/8/8/8/8/6k1/5q2/7K w - - 1 2").status).toEqual({
      type: "stalemate",
    })
    expect(result.opponent[0]?.uci).toBe("f3d1")
    expect(
      requests.some(
        (request) =>
          request.requestId.endsWith("/f3g2") ||
          request.requestId.endsWith("/f3f2"),
      ),
    ).toBe(false)
    expect(result.positionFen).toBe(position.fen)
    expect(position.turn).toBe("white")
  })

  it("returns no invented opponent hint when that side has no legal move on the unchanged projection", async () => {
    const position = requirePosition("7k/5Q2/5K2/8/8/8/8/8 w - - 0 1")
    const requests: StockfishSearchRequest[] = []
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(async (request) => {
        requests.push(request)
        return rankedResult(
          request.requestId,
          listLegalMatchMoves(position).map((move) => move.uci),
        )
      }),
    })
    const result = await analyst.analyze({
      playerColor: "white",
      position,
      requestId: "opponent-stalemate",
    })
    expect(result.player).toHaveLength(2)
    expect(result.opponent).toEqual([])
    expect(requests).toHaveLength(1)
    expect(requests[0]?.requestId).toBe("opponent-stalemate/player")
  })
  it.each([false, true])(
    "scores all checked-position opponent promotions and preserves ranking when mate scores use principal variations: %s",
    async (principalScores) => {
      const position = requirePosition("4k3/8/8/8/8/8/p3r3/4K3 w - - 0 1")
      const searched: StockfishSearchRequest[] = []
      const analyst = createBetterHintsAnalyst({
        engine: createEngine(async (request) => {
          searched.push(request)
          if (request.requestId.endsWith("/player"))
            return rankedResult(request.requestId, ["e1e2"])
          const score = {
            bound: "exact" as const,
            kind: "mate" as const,
            value: request.requestId.includes("a2a1q") ? -1 : 8,
          }
          return {
            requestId: request.requestId,
            bestMove: null,
            ...(principalScores
              ? { principalVariations: [{ rank: 1, moves: [], score }] }
              : { latestInformation: { score } }),
          }
        }),
      })
      const result = await analyst.analyze({
        playerColor: "white",
        position,
        requestId: "checked-promotion",
      })
      expect(result.opponent[0]?.uci).toBe("a2a1q")
      expect(result.opponent.map((hint) => hint.from)).toEqual([
        "a2",
        "e2",
        "e8",
      ])
      expect(
        searched.some((request) => request.requestId.endsWith("a2a1r")),
      ).toBe(true)
      expect(
        searched.some((request) => request.requestId.endsWith("a2a1b")),
      ).toBe(true)
      expect(
        searched.some((request) => request.requestId.endsWith("a2a1n")),
      ).toBe(true)
      expect(
        searched
          .slice(1)
          .reduce((total, request) => total + request.nodeLimit, 0),
      ).toBeLessThanOrEqual(BETTER_HINTS_NODE_LIMIT)
      expect(result.positionFen).toBe(position.fen)
    },
  )

  it("rejects scoreless checked-position output rather than fabricating hint quality", async () => {
    const position = requirePosition("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1")
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(async (request) =>
        request.requestId.endsWith("/player")
          ? rankedResult(request.requestId, ["e1e2"])
          : { requestId: request.requestId, bestMove: null },
      ),
    })
    await expect(
      analyst.analyze({
        playerColor: "white",
        position,
        requestId: "scoreless",
      }),
    ).rejects.toThrow("no score")
  })

  it("stops checked-position candidate work after cancellation instead of searching the remaining board", async () => {
    const controller = new AbortController()
    const searched: StockfishSearchRequest[] = []
    const position = requirePosition("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1")
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(async (request) => {
        searched.push(request)
        if (request.requestId.endsWith("/player"))
          return rankedResult(request.requestId, ["e1e2"])
        controller.abort()
        return {
          requestId: request.requestId,
          bestMove: null,
          latestInformation: {
            score: { bound: "exact", kind: "centipawns", value: 0 },
          },
        }
      }),
    })
    await expect(
      analyst.analyze(
        { playerColor: "white", position, requestId: "cancel-checked" },
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(searched).toHaveLength(2)
  })

  it("uses both projected colors when the player is Black without changing the canonical board", async () => {
    const position = requirePosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
    )
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(async (request) =>
        rankedResult(
          request.requestId,
          request.requestId.endsWith("/player")
            ? ["e7e5", "g8f6", "d7d5"]
            : ["e2e4", "g1f3", "d2d4"],
        ),
      ),
    })
    const result = await analyst.analyze({
      playerColor: "black",
      position,
      requestId: "black-hints",
    })
    expect(result.player.every((hint) => hint.color === "black")).toBe(true)
    expect(result.opponent.every((hint) => hint.color === "white")).toBe(true)
    expect(position.turn).toBe("black")
  })
  it("keeps Chess960 castling intent for both sides on the unchanged board", async () => {
    const layout = parseChess960PositionId(0)
    if (!layout.ok) throw new Error("Invalid test layout")
    const reconstructed = reconstructMatchPosition(
      { variant: "chess960", chess960PositionId: layout.positionId },
      "r5kr/8/8/8/8/8/8/R5KR w HAha - 0 1",
    )
    if (!reconstructed.ok) throw new Error("Invalid test position")
    const position = reconstructed.position
    const requests: StockfishSearchRequest[] = []
    const analyst = createBetterHintsAnalyst({
      engine: createEngine(async (request) => {
        requests.push(request)
        return rankedResult(
          request.requestId,
          requests.length === 1
            ? ["g1h1", "a1a2", "h1h2"]
            : ["g8h8", "a8a7", "h8h7"],
        )
      }),
    })
    const result = await analyst.analyze({
      playerColor: "white",
      position,
      requestId: "chess960-hints",
    })
    expect(result.player).toHaveLength(3)
    expect(result.opponent).toHaveLength(3)
    expect(result.player[0]).toEqual({
      color: "white",
      from: "g1",
      to: "g1",
      uci: "g1h1",
      castling: { rookFrom: "h1", rookTo: "f1", side: "king" },
    })
    expect(result.opponent[0]).toEqual({
      color: "black",
      from: "g8",
      to: "g8",
      uci: "g8h8",
      castling: { rookFrom: "h8", rookTo: "f8", side: "king" },
    })
    expect(requests[0]?.position.fen).toBe(position.fen)
    expect(requests[1]?.position.fen).toBe(position.fen.replace(" w ", " b "))
    expect(result.positionFen).toBe(position.fen)
    expect(position.turn).toBe("white")
  })

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

import { describe, expect, it } from "vitest"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
} from "@mapachess/match/match-position"
import type {
  StockfishEngineSearchResult,
  StockfishEngineSession,
  StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import {
  evaluatePositionWithStockfish,
  POSITION_EVALUATION_NODE_LIMIT,
  type PositionEvaluationRequest,
} from "../src/positionEvaluator"

const initialPosition = (): MatchPosition =>
  createInitialMatchPosition({
    chess960PositionId: null,
    variant: "standard",
  })

const requirePosition = (fen: string): MatchPosition => {
  const reconstructed = reconstructMatchPosition(
    { chess960PositionId: null, variant: "standard" },
    fen,
  )
  if (!reconstructed.ok) throw new Error(`Expected a legal position: ${fen}`)
  return reconstructed.position
}

const evaluationRequest = (
  position: MatchPosition = initialPosition(),
): PositionEvaluationRequest =>
  Object.freeze({ position, requestId: "evaluation/test/1" })

const sessionReturning = (
  result: StockfishEngineSearchResult,
): Readonly<{
  requests: StockfishSearchRequest[]
  session: StockfishEngineSession
}> => {
  const requests: StockfishSearchRequest[] = []
  const session: StockfishEngineSession = {
    boot: async () => ({ author: "Stockfish developers", name: "Stockfish" }),
    close: async () => undefined,
    search: async (request) => {
      requests.push(request)
      return result
    },
    state: () => "ready",
  }
  return { requests, session }
}

describe("evaluatePositionWithStockfish", () => {
  it("returns terminal truth without spending an engine search", async () => {
    const terminal = requirePosition("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1")
    const scripted = sessionReturning({
      bestMove: null,
      requestId: "must-not-run",
    })

    await expect(
      evaluatePositionWithStockfish(
        scripted.session,
        evaluationRequest(terminal),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      evaluation: { kind: "mate", moves: 0, winner: "white" },
    })
    expect(scripted.requests).toEqual([])
  })

  it("uses the canonical node budget and final rank-one score", async () => {
    const request = evaluationRequest()
    const scripted = sessionReturning({
      bestMove: "e2e4",
      latestInformation: {
        score: { bound: "exact", kind: "centipawns", value: 5 },
      },
      principalVariations: [
        {
          moves: ["e2e4"],
          rank: 1,
          score: { bound: "lower", kind: "centipawns", value: 42 },
        },
      ],
      requestId: request.requestId,
    })

    await expect(
      evaluatePositionWithStockfish(
        scripted.session,
        request,
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      evaluation: {
        bound: "lower",
        kind: "centipawns",
        whiteCentipawns: 42,
      },
      positionFen: request.position.fen,
      requestId: request.requestId,
    })
    expect(scripted.requests).toEqual([
      {
        nodeLimit: POSITION_EVALUATION_NODE_LIMIT,
        position: { fen: request.position.fen, moves: [] },
        requestId: request.requestId,
      },
    ])
  })

  it("falls back to the latest scored information", async () => {
    const request = evaluationRequest()
    const scripted = sessionReturning({
      bestMove: "e2e4",
      latestInformation: {
        score: { bound: "exact", kind: "mate", value: -3 },
      },
      requestId: request.requestId,
    })

    await expect(
      evaluatePositionWithStockfish(
        scripted.session,
        request,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      evaluation: { kind: "mate", moves: 3, winner: "black" },
    })
  })

  it("rejects mismatched response identity before reading its score", async () => {
    const request = evaluationRequest()
    const scripted = sessionReturning({
      bestMove: "e2e4",
      requestId: "evaluation/stale",
    })

    await expect(
      evaluatePositionWithStockfish(
        scripted.session,
        request,
        new AbortController().signal,
      ),
    ).rejects.toThrow("Rejected stale position evaluation response")
  })

  it("rejects a completed search without a scored information line", async () => {
    const request = evaluationRequest()
    const scripted = sessionReturning({
      bestMove: "e2e4",
      requestId: request.requestId,
    })

    await expect(
      evaluatePositionWithStockfish(
        scripted.session,
        request,
        new AbortController().signal,
      ),
    ).rejects.toThrow("completed position evaluation without a score")
  })
})

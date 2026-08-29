import { describe, expect, it, vi } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchOpponentRequest } from "@mapachess/match/match-machine"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSession,
  type StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import createStandardChickenOpponent, {
  generateStandardChickenMatchSeed,
  selectStandardStoryPlayerColor,
  STANDARD_CHICKEN_NODE_LIMIT,
  STANDARD_CHICKEN_WEB_SEED_DERIVATION_VERSION,
  type StandardChickenCryptography,
} from "./standardChickenOpponent"

const RANDOM_POSITION_SEED = "00000001000000020000000300000004"
const STOCKFISH_POSITION_SEED = "00000001000000050000000300000004"
const BLACK_PLAYER_SEED = "00000001020000000000000300000004"
const DEFAULT_RANDOM_WORDS = [1, 2, 3, 4] as const

const seedDigest = (seed: string): ArrayBuffer => {
  const digest = new ArrayBuffer(32)
  const bytes = new Uint8Array(digest)
  for (let index = 0; index < seed.length; index += 2) {
    bytes[index / 2] = Number.parseInt(seed.slice(index, index + 2), 16)
  }
  return digest
}

const createCryptography = (
  positionSeed = RANDOM_POSITION_SEED,
  randomWords: readonly [number, number, number, number] = DEFAULT_RANDOM_WORDS,
  afterDigest?: () => void,
) => {
  const getRandomValues = <Value extends ArrayBufferView<ArrayBuffer> | null>(
    array: Value,
  ): Value => {
    if (!(array instanceof Uint32Array) || array.length !== 4) {
      throw new TypeError("Test cryptography expects four Uint32 words.")
    }
    array.set(randomWords)
    return array
  }
  const digest = vi.fn(
    async (
      _algorithm: AlgorithmIdentifier,
      _data: BufferSource,
    ): Promise<ArrayBuffer> => {
      afterDigest?.()
      return seedDigest(positionSeed)
    },
  )
  const cryptography = {
    getRandomValues,
    subtle: { digest },
  } satisfies StandardChickenCryptography

  return { cryptography, digest }
}

const createStandardRequest = (): MatchOpponentRequest => {
  const position = createInitialMatchPosition({
    chess960PositionId: null,
    variant: "standard",
  })

  return Object.freeze({
    acceptedMoves: Object.freeze([]),
    initialPosition: position,
    legalMoves: listLegalMatchMoves(position),
    position,
    requestId: "standard-story-chicken/test/opponent/ply/1",
  })
}

const createStandardRequestAfterE4 = (): MatchOpponentRequest => {
  const initialRequest = createStandardRequest()
  const e4 = initialRequest.legalMoves.find((move) => move.uci === "e2e4")
  if (e4 === undefined) throw new Error("Missing legal e2e4 fixture")
  const result = applyMatchMove(initialRequest.position, e4.id)
  if (!result.ok) throw new Error("Could not apply legal e2e4 fixture")

  return Object.freeze({
    acceptedMoves: Object.freeze([result.transition.move]),
    initialPosition: initialRequest.initialPosition,
    legalMoves: listLegalMatchMoves(result.transition.after),
    position: result.transition.after,
    requestId: "standard-story-chicken/test/opponent/ply/2",
  })
}

const createSession = (
  resultFor: (request: StockfishSearchRequest) => Readonly<{
    bestMove: string | null
    requestId: string
  }>,
) => {
  const search = vi.fn(async (request: StockfishSearchRequest) =>
    resultFor(request),
  )
  const session = {
    boot: async () => ({ author: "Stockfish developers", name: "Stockfish" }),
    close: async () => undefined,
    search,
    state: () => "ready" as const,
  } satisfies StockfishEngineSession

  return { search, session }
}

describe("provisional Standard Chicken opponent", () => {
  it("creates a nonzero cryptographic match seed and both Story colors", () => {
    const { cryptography } = createCryptography()

    expect(generateStandardChickenMatchSeed(cryptography)).toBe(
      RANDOM_POSITION_SEED,
    )
    expect(
      selectStandardStoryPlayerColor(
        parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      ),
    ).toBe("white")
    expect(
      selectStandardStoryPlayerColor(
        parseDeterministicRandomSeed(BLACK_PLAYER_SEED),
      ),
    ).toBe("black")
  })

  it("selects uniformly from sorted legal moves without searching", async () => {
    const { cryptography, digest } = createCryptography()
    const { search, session } = createSession((request) => ({
      bestMove: "e2e4",
      requestId: request.requestId,
    }))
    const matchSeed = parseDeterministicRandomSeed(RANDOM_POSITION_SEED)
    const opponent = createStandardChickenOpponent(
      session,
      cryptography,
      matchSeed,
    )
    const request = createStandardRequest()
    const signal = new AbortController().signal

    const selected = await opponent.selectMove(request, signal)
    const selectedAfterReordering = await opponent.selectMove(
      { ...request, legalMoves: [...request.legalMoves].reverse() },
      signal,
    )

    expect(selectedAfterReordering).toBe(selected)
    expect(request.legalMoves.some((move) => move.id === selected)).toBe(true)
    expect(search).not.toHaveBeenCalled()
    const digestInput = digest.mock.calls[0]?.[1]
    if (digestInput === undefined) throw new Error("Missing digest input")
    const digestBytes = ArrayBuffer.isView(digestInput)
      ? new Uint8Array(
          digestInput.buffer,
          digestInput.byteOffset,
          digestInput.byteLength,
        )
      : new Uint8Array(digestInput)
    expect(new TextDecoder().decode(digestBytes)).toBe(
      JSON.stringify([
        STANDARD_CHICKEN_WEB_SEED_DERIVATION_VERSION,
        matchSeed,
        request.requestId,
      ]),
    )
  })

  it("searches exactly 10,000 nodes only on the Stockfish branch", async () => {
    const { cryptography } = createCryptography(STOCKFISH_POSITION_SEED)
    const { search, session } = createSession((request) => ({
      bestMove: "e7e5",
      requestId: request.requestId,
    }))
    const opponent = createStandardChickenOpponent(
      session,
      cryptography,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
    )
    const request = createStandardRequestAfterE4()
    const signal = new AbortController().signal

    await expect(opponent.selectMove(request, signal)).resolves.toBe("e7e5")
    expect(search).toHaveBeenCalledWith(
      {
        nodeLimit: STANDARD_CHICKEN_NODE_LIMIT,
        position: { fen: request.initialPosition.fen, moves: ["e2e4"] },
        requestId: request.requestId,
      },
      signal,
    )
  })

  it.each([
    {
      bestMove: "e2e4",
      responseRequestId: "stale-request",
      expectedMessage: "stale opponent response",
    },
    {
      bestMove: "a1a1",
      responseRequestId: undefined,
      expectedMessage: "no canonical legal move",
    },
    {
      bestMove: null,
      responseRequestId: undefined,
      expectedMessage: "no canonical legal move",
    },
  ])(
    "rejects an invalid engine result: $expectedMessage",
    async ({ bestMove, expectedMessage, responseRequestId }) => {
      const { cryptography } = createCryptography(STOCKFISH_POSITION_SEED)
      const { session } = createSession((request) => ({
        bestMove,
        requestId: responseRequestId ?? request.requestId,
      }))
      const opponent = createStandardChickenOpponent(
        session,
        cryptography,
        parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      )

      await expect(
        opponent.selectMove(
          createStandardRequest(),
          new AbortController().signal,
        ),
      ).rejects.toThrow(expectedMessage)
    },
  )

  it("rejects Chess960 before deriving or searching", async () => {
    const positionId = parseChess960PositionId(0)
    if (!positionId.ok) throw new Error("Invalid Chess960 test position")
    const position = createInitialMatchPosition({
      chess960PositionId: positionId.positionId,
      variant: "chess960",
    })
    const request: MatchOpponentRequest = {
      acceptedMoves: [],
      initialPosition: position,
      legalMoves: listLegalMatchMoves(position),
      position,
      requestId: "chess960-rejected",
    }
    const { cryptography, digest } = createCryptography()
    const { search, session } = createSession((engineRequest) => ({
      bestMove: "a2a3",
      requestId: engineRequest.requestId,
    }))
    const opponent = createStandardChickenOpponent(
      session,
      cryptography,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
    )

    await expect(
      opponent.selectMove(request, new AbortController().signal),
    ).rejects.toThrow("non-Standard position")
    expect(digest).not.toHaveBeenCalled()
    expect(search).not.toHaveBeenCalled()
  })

  it("honors cancellation both before and after async seed derivation", async () => {
    const alreadyAborted = new AbortController()
    alreadyAborted.abort()
    const before = createCryptography(STOCKFISH_POSITION_SEED)
    const beforeSession = createSession((request) => ({
      bestMove: "e2e4",
      requestId: request.requestId,
    }))
    const beforeOpponent = createStandardChickenOpponent(
      beforeSession.session,
      before.cryptography,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
    )

    await expect(
      beforeOpponent.selectMove(createStandardRequest(), alreadyAborted.signal),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(before.digest).not.toHaveBeenCalled()

    const duringDerivation = new AbortController()
    const after = createCryptography(
      STOCKFISH_POSITION_SEED,
      DEFAULT_RANDOM_WORDS,
      () => duringDerivation.abort(),
    )
    const afterSession = createSession((request) => ({
      bestMove: "e2e4",
      requestId: request.requestId,
    }))
    const afterOpponent = createStandardChickenOpponent(
      afterSession.session,
      after.cryptography,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
    )

    await expect(
      afterOpponent.selectMove(
        createStandardRequest(),
        duringDerivation.signal,
      ),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(afterSession.search).not.toHaveBeenCalled()
  })
})

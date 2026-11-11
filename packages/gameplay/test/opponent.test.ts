import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchOpponentRequest } from "@mapachess/match/match-machine"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "@mapachess/match/match-position"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  StockfishOperationAbortedError,
  type StockfishEngineSession,
  type StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import {
  OPPONENT_POSITION_SEED_DERIVATION_VERSION,
  parseDeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"
import { selectStoryPlayerColor } from "../src/matchIdentity.js"
import createMatchOpponent, { generateMatchSeed } from "../src/opponent.js"
import resolveOpponentPolicy from "../src/opponentPolicy.js"

const storyPolicy = (opponentId: StockfishOpponentId, variant: MatchVariant) =>
  resolveOpponentPolicy(opponentId, variant, async (text) =>
    createHash("sha256").update(text).digest("hex"),
  )

const RANDOM_POSITION_SEED = "00000001000000020000000300000004"
const STOCKFISH_POSITION_SEED = "000000010000001a0000000300000004"
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

const createSeedFixture = (
  positionSeed = RANDOM_POSITION_SEED,
  randomWords: readonly [number, number, number, number] = DEFAULT_RANDOM_WORDS,
  afterDigest?: () => void,
) => {
  const fillRandomWords = (words: Uint32Array<ArrayBuffer>) => {
    words.set(randomWords)
    return words
  }
  const digest = vi.fn(async (_bytes: Uint8Array<ArrayBuffer>) => {
    afterDigest?.()
    return seedDigest(positionSeed)
  })
  return { fillRandomWords, digest }
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

describe("deterministic cross-platform opponent execution", () => {
  it.each(["standard", "chess960"] as const)(
    "executes the complete measured %s roster with deterministic legal choices",
    async (variant) => {
      const parsed = parseChess960PositionId(0)
      if (!parsed.ok) throw new Error("Invalid test layout")
      const position = createInitialMatchPosition(
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId },
      )
      const legalMoves = listLegalMatchMoves(position)
      const engineMove = legalMoves[0]
      if (engineMove === undefined) throw new Error("Missing legal test move")
      const request: MatchOpponentRequest = {
        acceptedMoves: [],
        initialPosition: position,
        legalMoves,
        position,
        requestId: `${variant}/measured-policy/opponent/ply/1`,
      }
      for (const { id } of STOCKFISH_OPPONENTS) {
        const policy = await storyPolicy(id, variant)
        for (const [positionSeed, draw] of [
          [RANDOM_POSITION_SEED, 1520],
          ["00000001000000050000000300000004", 8800],
          [STOCKFISH_POSITION_SEED, 9760],
        ] as const) {
          const { digest } = createSeedFixture(positionSeed)
          const { session, search } = createSession(({ requestId }) => ({
            bestMove: engineMove.uci,
            requestId,
          }))
          const opponent = createMatchOpponent(
            session,
            digest,
            parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
            policy,
          )
          const signal = new AbortController().signal
          const move = await opponent.selectMove(request, signal)
          expect(legalMoves.some(({ id }) => id === move)).toBe(true)
          expect(
            await opponent.selectMove(
              { ...request, legalMoves: [...legalMoves].reverse() },
              signal,
            ),
          ).toBe(move)
          if (draw < policy.randomMoveProbabilityBasisPoints) {
            expect(search).not.toHaveBeenCalled()
          } else {
            expect(move).toBe(engineMove.id)
            expect(search).toHaveBeenCalledTimes(2)
            expect(search).toHaveBeenCalledWith(
              {
                nodeLimit: 10_000,
                position: { fen: position.fen, moves: [] },
                requestId: request.requestId,
              },
              signal,
            )
          }
        }
      }
    },
  )

  it.each([RANDOM_POSITION_SEED, STOCKFISH_POSITION_SEED])(
    "selects canonical Chess960 moves with position seed %s",
    async (positionSeed) => {
      const parsed = parseChess960PositionId(0)
      if (!parsed.ok) throw new Error("Invalid layout fixture")
      const reconstructed = reconstructMatchPosition(
        { variant: "chess960", chess960PositionId: parsed.positionId },
        "4k3/8/8/8/8/8/8/R5KR w HA - 0 1",
      )
      if (!reconstructed.ok) throw new Error("Invalid castling fixture")
      const position = reconstructed.position
      const request: MatchOpponentRequest = {
        acceptedMoves: [],
        initialPosition: position,
        legalMoves: listLegalMatchMoves(position),
        position,
        requestId: "chess960/castle",
      }
      const { digest } = createSeedFixture(positionSeed)
      const { session, search } = createSession((request) => ({
        bestMove: "g1h1",
        requestId: request.requestId,
      }))
      const opponent = createMatchOpponent(
        session,
        digest,
        parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
        await storyPolicy("chicken-stockfish", "chess960"),
      )
      const result = await opponent.selectMove(
        request,
        new AbortController().signal,
      )
      expect(request.legalMoves.some((move) => move.id === result)).toBe(true)
      if (positionSeed === STOCKFISH_POSITION_SEED) {
        expect(result).toBe("g1h1")
        expect(search).toHaveBeenCalledWith(
          expect.objectContaining({
            position: { fen: position.fen, moves: [] },
          }),
          expect.any(AbortSignal),
        )
      } else expect(search).not.toHaveBeenCalled()
    },
  )

  it("creates a nonzero cryptographic match seed and both Story colors", () => {
    const { fillRandomWords } = createSeedFixture()

    expect(generateMatchSeed(fillRandomWords)).toBe(RANDOM_POSITION_SEED)
    expect(
      selectStoryPlayerColor(
        parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      ),
    ).toBe("white")
    expect(
      selectStoryPlayerColor(parseDeterministicRandomSeed(BLACK_PLAYER_SEED)),
    ).toBe("black")
  })

  it("selects uniformly from sorted legal moves without searching", async () => {
    const { digest } = createSeedFixture()
    const { search, session } = createSession((request) => ({
      bestMove: "e2e4",
      requestId: request.requestId,
    }))
    const matchSeed = parseDeterministicRandomSeed(RANDOM_POSITION_SEED)
    const opponent = createMatchOpponent(
      session,
      digest,
      matchSeed,
      await storyPolicy("chicken-stockfish", "standard"),
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
    const digestInput = digest.mock.calls[0]?.[0]
    if (digestInput === undefined) throw new Error("Missing digest input")
    expect(new TextDecoder().decode(digestInput)).toBe(
      JSON.stringify([
        OPPONENT_POSITION_SEED_DERIVATION_VERSION,
        matchSeed,
        request.requestId,
      ]),
    )
  })

  it("searches exactly 10,000 nodes only on the Stockfish branch", async () => {
    const { digest } = createSeedFixture(STOCKFISH_POSITION_SEED)
    const { search, session } = createSession((request) => ({
      bestMove: "e7e5",
      requestId: request.requestId,
    }))
    const opponent = createMatchOpponent(
      session,
      digest,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      await storyPolicy("chicken-stockfish", "standard"),
    )
    const request = createStandardRequestAfterE4()
    const signal = new AbortController().signal

    await expect(opponent.selectMove(request, signal)).resolves.toBe("e7e5")
    expect(search).toHaveBeenCalledWith(
      {
        nodeLimit: 10_000,
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
      const { digest } = createSeedFixture(STOCKFISH_POSITION_SEED)
      const { session } = createSession((request) => ({
        bestMove,
        requestId: responseRequestId ?? request.requestId,
      }))
      const opponent = createMatchOpponent(
        session,
        digest,
        parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
        await storyPolicy("chicken-stockfish", "standard"),
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
    const { digest } = createSeedFixture()
    const { search, session } = createSession((engineRequest) => ({
      bestMove: "a2a3",
      requestId: engineRequest.requestId,
    }))
    const opponent = createMatchOpponent(
      session,
      digest,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      await storyPolicy("chicken-stockfish", "standard"),
    )

    await expect(
      opponent.selectMove(request, new AbortController().signal),
    ).rejects.toThrow("position for a different variant")
    expect(digest).not.toHaveBeenCalled()
    expect(search).not.toHaveBeenCalled()
  })

  it("honors cancellation both before and after async seed derivation", async () => {
    const alreadyAborted = new AbortController()
    alreadyAborted.abort()
    const before = createSeedFixture(STOCKFISH_POSITION_SEED)
    const beforeSession = createSession((request) => ({
      bestMove: "e2e4",
      requestId: request.requestId,
    }))
    const beforeOpponent = createMatchOpponent(
      beforeSession.session,
      before.digest,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      await storyPolicy("chicken-stockfish", "standard"),
    )

    await expect(
      beforeOpponent.selectMove(createStandardRequest(), alreadyAborted.signal),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(before.digest).not.toHaveBeenCalled()

    const duringDerivation = new AbortController()
    const after = createSeedFixture(
      STOCKFISH_POSITION_SEED,
      DEFAULT_RANDOM_WORDS,
      () => duringDerivation.abort(),
    )
    const afterSession = createSession((request) => ({
      bestMove: "e2e4",
      requestId: request.requestId,
    }))
    const afterOpponent = createMatchOpponent(
      afterSession.session,
      after.digest,
      parseDeterministicRandomSeed(RANDOM_POSITION_SEED),
      await storyPolicy("chicken-stockfish", "standard"),
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

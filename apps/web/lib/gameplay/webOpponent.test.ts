import { expect, it, vi } from "vitest"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { StockfishEngineSession } from "@mapachess/stockfish/engine-session"
import createWebOpponent, {
  generateWebChess960Position,
  generateWebMatchSeed,
  type WebOpponentCryptography,
} from "./webOpponent"
import resolveWebOpponentPolicy from "./webOpponentPolicy"

it("adapts browser random words and SHA-256 to the shared opponent", async () => {
  const digest = vi.fn<SubtleCrypto["digest"]>(async () => {
    const bytes = new Uint8Array(32)
    bytes.set([0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4])
    return bytes.buffer
  })
  const cryptography = {
    getRandomValues: <T extends ArrayBufferView<ArrayBuffer> | null>(
      words: T,
    ): T => {
      if (!(words instanceof Uint32Array))
        throw new TypeError("Expected a word seed")
      words.set([1, 2, 3, 4])
      return words
    },
    subtle: { digest },
  } satisfies WebOpponentCryptography
  const session = {
    boot: async () => ({ author: "Test engine", name: "Stockfish" }),
    close: async () => undefined,
    search: vi.fn<StockfishEngineSession["search"]>(),
    state: () => "ready",
  } satisfies StockfishEngineSession
  const seed = generateWebMatchSeed(cryptography)
  expect(seed).toBe("00000001000000020000000300000004")
  expect(generateWebChess960Position(cryptography)).toBeLessThan(960)
  const position = createInitialMatchPosition({
    variant: "standard",
    chess960PositionId: null,
  })
  const legalMoves = listLegalMatchMoves(position)
  const opponent = createWebOpponent(
    session,
    cryptography,
    seed,
    await resolveWebOpponentPolicy("chicken-stockfish", "standard"),
  )
  const selected = await opponent.selectMove(
    {
      acceptedMoves: [],
      initialPosition: position,
      legalMoves,
      position,
      requestId: "web-adapter/opponent/ply/1",
    },
    new AbortController().signal,
  )

  expect(legalMoves.some(({ id }) => id === selected)).toBe(true)
  expect(digest).toHaveBeenCalledExactlyOnceWith(
    "SHA-256",
    expect.any(Uint8Array),
  )
  expect(session.search).not.toHaveBeenCalled()
})

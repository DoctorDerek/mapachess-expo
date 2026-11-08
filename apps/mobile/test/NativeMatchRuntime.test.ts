import { createHash } from "node:crypto"
import { describe, expect, it, jest } from "@jest/globals"
import { BETTER_HINTS_NODE_LIMIT } from "@mapachess/hints/better-hints"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import createNativeStockfishSession from "@mapachess/stockfish-native/open-session"
import type { NativeMatchCryptography } from "@/lib/gameplay/nativeCryptography"
import openNativeMatchRuntime from "@/lib/gameplay/openNativeMatchRuntime"
import NativeEngineFixture from "./nativeEngineFixture"

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: jest.fn(),
  digestStringAsync: jest.fn(),
  getRandomValues: jest.fn(),
}))

const cryptography: NativeMatchCryptography = {
  digestBytes: async (bytes) =>
    Uint8Array.from(createHash("sha256").update(bytes).digest()).buffer,
  fillRandomWords: (words) => {
    words.set([1, 2, 3, 4])
    return words
  },
  sha256: async (text) => createHash("sha256").update(text).digest("hex"),
}

describe("native match runtime", () => {
  it("connects real native session wrappers to shared hints, evaluation, and opponent behavior", async () => {
    const bridge = new NativeEngineFixture()
    const runtime = await openNativeMatchRuntime({
      cryptography,
      openSession: (configuration) =>
        createNativeStockfishSession(configuration, bridge),
    })
    expect(bridge.booted.map(({ multiPv }) => multiPv)).toEqual([1, 256, 1])
    expect(runtime.nativeBuildIdentity.inputId).toBe("stockfish-18-lite")
    expect(runtime.ratedOpponentElo).toBe(100)
    const position = createInitialMatchPosition(runtime.startingPosition)
    const originalFen = position.fen
    const hints = await runtime.hintAnalyst.analyze({
      playerColor: "white",
      position,
      requestId: "native-hints",
    })
    expect(hints.player).toHaveLength(3)
    expect(hints.opponent).toHaveLength(3)
    expect(new Set(hints.player.map(({ from }) => from)).size).toBe(3)
    expect(new Set(hints.opponent.map(({ from }) => from)).size).toBe(3)
    expect(bridge.requests.map(({ request }) => request.nodeLimit)).toEqual([
      BETTER_HINTS_NODE_LIMIT,
      BETTER_HINTS_NODE_LIMIT,
    ])
    expect(position.fen).toBe(originalFen)
    const signal = new AbortController().signal
    const evaluation = await runtime.positionEvaluator(
      { position, requestId: "native-evaluation" },
      signal,
    )
    expect(evaluation.requestId).toBe("native-evaluation")
    expect(evaluation.positionFen).toBe(originalFen)
    const legalMoves = listLegalMatchMoves(position)
    const selected = await runtime.opponent.selectMove(
      {
        acceptedMoves: [],
        initialPosition: position,
        legalMoves,
        position,
        requestId: "native-opponent",
      },
      signal,
    )
    expect(legalMoves.some(({ id }) => id === selected)).toBe(true)
    const closing = runtime.close()
    expect(runtime.close()).toBe(closing)
    await closing
    expect(bridge.closedSessions).toHaveLength(3)
    expect(new Set(bridge.closedSessions).size).toBe(3)
  })

  it("closes every role after a partial boot failure", async () => {
    const bridge = new NativeEngineFixture()
    const error = new Error("second role failed")
    bridge.bootFailure = { ordinal: 2, error }
    await expect(
      openNativeMatchRuntime({
        cryptography,
        openSession: (configuration) =>
          createNativeStockfishSession(configuration, bridge),
      }),
    ).rejects.toBe(error)
    expect(new Set(bridge.closedSessions)).toEqual(new Set(bridge.allocated))
    expect(bridge.allocated).toHaveLength(3)
  })

  it("closes a previously allocated role if later allocation throws", async () => {
    const bridge = new NativeEngineFixture()
    let allocations = 0
    const error = new Error("cannot allocate second role")
    await expect(
      openNativeMatchRuntime({
        cryptography,
        openSession: (configuration) => {
          allocations += 1
          if (allocations === 2) throw error
          return createNativeStockfishSession(configuration, bridge)
        },
      }),
    ).rejects.toBe(error)
    expect(bridge.closedSessions).toEqual(bridge.allocated)
    expect(bridge.allocated).toHaveLength(1)
  })

  it("rejects canceled or unavailable saved policies before opening engines", async () => {
    const bridge = new NativeEngineFixture()
    const controller = new AbortController()
    controller.abort()
    const openSession = (
      configuration: Parameters<typeof createNativeStockfishSession>[0],
    ) => createNativeStockfishSession(configuration, bridge)
    await expect(
      openNativeMatchRuntime({
        cryptography,
        openSession,
        signal: controller.signal,
      }),
    ).rejects.toThrow()
    await expect(
      openNativeMatchRuntime({
        cryptography,
        openSession,
        opponentPolicyFingerprint: "unavailable",
      }),
    ).rejects.toThrow()
    expect(bridge.allocated).toEqual([])
  })

  it("opens fresh independent sessions after closing a previous match", async () => {
    const bridge = new NativeEngineFixture()
    const openSession = (
      configuration: Parameters<typeof createNativeStockfishSession>[0],
    ) => createNativeStockfishSession(configuration, bridge)
    const first = await openNativeMatchRuntime({ cryptography, openSession })
    await first.close()
    const second = await openNativeMatchRuntime({
      cryptography,
      openSession,
      setup: { variant: "chess960" },
      mode: "challenge",
      playerColor: "black",
      difficultyTargetElo: 375,
    })
    expect(second.playerColor).toBe("black")
    expect(second.startingPosition.variant).toBe("chess960")
    expect(second.ratedOpponentElo).toBe(375)
    expect(bridge.booted.slice(3).every(({ isChess960 }) => isChess960)).toBe(
      true,
    )
    await second.close()
    expect(new Set(bridge.allocated).size).toBe(6)
    expect(new Set(bridge.closedSessions)).toEqual(new Set(bridge.allocated))
  })
})

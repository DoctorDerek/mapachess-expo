import { describe, expect, it, vi } from "vitest"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import type { CreateWebStockfishSessionOptions } from "../stockfish/createWebStockfishSession"
import openStandardChickenRuntime from "./openStandardChickenRuntime"
import type { StandardChickenCryptography } from "./standardChickenOpponent"
import { STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT } from "./standardChickenOpponent"

const ENGINE_IDENTITY: StockfishUciIdentity = Object.freeze({
  author: "the Stockfish developers",
  name: "Stockfish 18 Lite WASM",
  optionNames: Object.freeze([]),
})

const OPPONENT_CONFIGURATION: StockfishEngineConfiguration = Object.freeze({
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
  variant: "standard",
})

const HINT_CONFIGURATION: StockfishEngineConfiguration = Object.freeze({
  hashMegabytes: 16,
  multiPv: 256,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
  variant: "standard",
})

const createCryptography = (): StandardChickenCryptography => {
  const getRandomValues = <Value extends ArrayBufferView<ArrayBuffer> | null>(
    array: Value,
  ): Value => {
    if (!(array instanceof Uint32Array) || array.length !== 4) {
      throw new TypeError("Test cryptography expects four Uint32 words.")
    }
    array.set([1, 2, 3, 4])
    return array
  }

  return { getRandomValues, subtle: globalThis.crypto.subtle }
}

const createSession = (
  bootBehavior: (signal?: AbortSignal) => Promise<StockfishUciIdentity>,
  closeBehavior: () => Promise<void> = async () => undefined,
) => {
  const boot = vi.fn(bootBehavior)
  const close = vi.fn(closeBehavior)
  const session = {
    boot,
    close,
    search: vi.fn(async () => ({
      bestMove: "e2e4",
      informationLineCount: 1,
      requestId: "unused",
    })),
    state: () => "ready" as const,
  } satisfies StockfishUciSession

  return { boot, close, session }
}

const createSessionQueue = (sessions: readonly StockfishUciSession[]) => {
  let index = 0
  return vi.fn(
    (
      _configuration: StockfishEngineConfiguration,
      _options?: CreateWebStockfishSessionOptions,
    ): StockfishUciSession => {
      const session = sessions[index]
      index += 1
      if (session === undefined) {
        throw new Error("Test session queue is exhausted.")
      }
      return session
    },
  )
}

describe("Standard Chicken runtime ownership", () => {
  it("boots isolated opponent and Better Hints sessions", async () => {
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const openSession = createSessionQueue([opponent.session, hints.session])

    const runtime = await openStandardChickenRuntime({
      cryptography: createCryptography(),
      openSession,
    })

    expect(openSession).toHaveBeenNthCalledWith(1, OPPONENT_CONFIGURATION, {
      workerName: "mapachess-stockfish-18-opponent",
    })
    expect(openSession).toHaveBeenNthCalledWith(2, HINT_CONFIGURATION, {
      workerName: "mapachess-stockfish-18-better-hints",
    })
    expect(opponent.boot).toHaveBeenCalledWith(undefined)
    expect(hints.boot).toHaveBeenCalledWith(undefined)
    expect(runtime).toMatchObject({
      engineIdentity: ENGINE_IDENTITY,
      matchId: "standard-story-chicken/00000001000000020000000300000004",
      matchSeed: "00000001000000020000000300000004",
      opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
      playerColor: "white",
    })
    expect(runtime.hintAnalyst.analyze).toEqual(expect.any(Function))

    await runtime.close()
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
  })

  it("reopens the same deterministic match identity from a saved seed", async () => {
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const matchSeed = parseDeterministicRandomSeed(
      "00000005000000060000000700000008",
      "reopened Chicken test seed",
    )

    const runtime = await openStandardChickenRuntime({
      cryptography: createCryptography(),
      matchSeed,
      openSession: createSessionQueue([opponent.session, hints.session]),
    })

    expect(runtime).toMatchObject({
      matchId: `standard-story-chicken/${matchSeed}`,
      matchSeed,
    })
    await runtime.close()
  })

  it("closes both sessions when cancellation arrives after boot", async () => {
    const controller = new AbortController()
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => {
      controller.abort()
      return ENGINE_IDENTITY
    })

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([opponent.session, hints.session]),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
  })

  it("closes both sessions when opponent boot fails", async () => {
    const bootError = new Error("opponent boot failed")
    const opponent = createSession(async () => {
      throw bootError
    })
    const hints = createSession(async () => ENGINE_IDENTITY)

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([opponent.session, hints.session]),
      }),
    ).rejects.toBe(bootError)
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.boot).not.toHaveBeenCalled()
    expect(hints.close).toHaveBeenCalledTimes(1)
  })

  it("closes both sessions when Better Hints boot fails", async () => {
    const bootError = new Error("hint boot failed")
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => {
      throw bootError
    })

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([opponent.session, hints.session]),
      }),
    ).rejects.toBe(bootError)
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
  })

  it("closes the opponent session when hint construction fails", async () => {
    const constructionError = new Error("hint construction failed")
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const openSession = vi
      .fn<
        (
          configuration: StockfishEngineConfiguration,
          options?: CreateWebStockfishSessionOptions,
        ) => StockfishUciSession
      >()
      .mockReturnValueOnce(opponent.session)
      .mockImplementationOnce(() => {
        throw constructionError
      })

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession,
      }),
    ).rejects.toBe(constructionError)
    expect(opponent.boot).not.toHaveBeenCalled()
    expect(opponent.close).toHaveBeenCalledTimes(1)
  })

  it("reports boot and every cleanup failure together", async () => {
    const bootError = new Error("boot failed")
    const opponentCloseError = new Error("opponent close failed")
    const hintCloseError = new Error("hint close failed")
    const opponent = createSession(
      async () => {
        throw bootError
      },
      async () => {
        throw opponentCloseError
      },
    )
    const hints = createSession(
      async () => ENGINE_IDENTITY,
      async () => {
        throw hintCloseError
      },
    )

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([opponent.session, hints.session]),
      }),
    ).rejects.toEqual(
      new AggregateError(
        [bootError, opponentCloseError, hintCloseError],
        "Standard Chicken failed to open and close cleanly.",
      ),
    )
  })

  it("reports every runtime close failure together", async () => {
    const opponentCloseError = new Error("opponent close failed")
    const hintCloseError = new Error("hint close failed")
    const opponent = createSession(
      async () => ENGINE_IDENTITY,
      async () => {
        throw opponentCloseError
      },
    )
    const hints = createSession(
      async () => ENGINE_IDENTITY,
      async () => {
        throw hintCloseError
      },
    )
    const runtime = await openStandardChickenRuntime({
      cryptography: createCryptography(),
      openSession: createSessionQueue([opponent.session, hints.session]),
    })

    await expect(runtime.close()).rejects.toEqual(
      new AggregateError(
        [opponentCloseError, hintCloseError],
        "Standard Chicken sessions failed to close cleanly.",
      ),
    )
  })
})

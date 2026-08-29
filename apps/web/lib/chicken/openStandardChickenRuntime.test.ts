import { describe, expect, it, vi } from "vitest"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import openStandardChickenRuntime from "./openStandardChickenRuntime"
import type { StandardChickenCryptography } from "./standardChickenOpponent"

const ENGINE_IDENTITY: StockfishUciIdentity = Object.freeze({
  author: "the Stockfish developers",
  name: "Stockfish 18 Lite WASM",
  optionNames: Object.freeze([]),
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

describe("Standard Chicken runtime ownership", () => {
  it("boots the pinned configuration and exposes one owned runtime", async () => {
    const fake = createSession(async () => ENGINE_IDENTITY)
    const openSession = vi.fn(
      (_configuration: StockfishEngineConfiguration) => fake.session,
    )

    const runtime = await openStandardChickenRuntime({
      cryptography: createCryptography(),
      openSession,
    })

    expect(openSession).toHaveBeenCalledWith({
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
      strength: { kind: "full-strength" },
      threads: 1,
      variant: "standard",
    })
    expect(fake.boot).toHaveBeenCalledWith(undefined)
    expect(runtime).toMatchObject({
      engineIdentity: ENGINE_IDENTITY,
      matchId: "standard-story-chicken/00000001000000020000000300000004",
      matchSeed: "00000001000000020000000300000004",
      playerColor: "white",
    })

    await runtime.close()
    expect(fake.close).toHaveBeenCalledTimes(1)
  })

  it("closes when cancellation arrives as boot completes", async () => {
    const controller = new AbortController()
    const fake = createSession(async () => {
      controller.abort()
      return ENGINE_IDENTITY
    })

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: () => fake.session,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fake.close).toHaveBeenCalledTimes(1)
  })

  it("closes after boot failure and preserves the original failure", async () => {
    const bootError = new Error("boot failed")
    const fake = createSession(async () => {
      throw bootError
    })

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: () => fake.session,
      }),
    ).rejects.toBe(bootError)
    expect(fake.close).toHaveBeenCalledTimes(1)
  })

  it("reports both failures when failed boot cleanup also fails", async () => {
    const bootError = new Error("boot failed")
    const closeError = new Error("close failed")
    const fake = createSession(
      async () => {
        throw bootError
      },
      async () => {
        throw closeError
      },
    )

    await expect(
      openStandardChickenRuntime({
        cryptography: createCryptography(),
        openSession: () => fake.session,
      }),
    ).rejects.toEqual(
      new AggregateError(
        [bootError, closeError],
        "Standard Chicken failed to open and close cleanly.",
      ),
    )
  })
})

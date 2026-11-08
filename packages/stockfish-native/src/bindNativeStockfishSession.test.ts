import { describe, expect, it, vi } from "vitest"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import bindNativeStockfishSession, {
  type NativeStockfishBridge,
} from "./bindNativeStockfishSession"
import type {
  NativeStockfishBestMoveMessage,
  NativeStockfishClosedMessage,
  NativeStockfishFailureMessage,
  NativeStockfishReadyMessage,
  NativeStockfishSearchInformationMessage,
} from "./NativeMapachessStockfish"
import type { NativeEvent } from "./nativeStockfishBoundary"
import NativeStockfishSession from "./nativeStockfishSession"

const CONFIGURATION = {
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: { kind: "full-strength" },
  threads: 1,
  variant: "standard",
} as const satisfies StockfishEngineConfiguration

function nativeEvent<Payload>() {
  const listeners = new Set<(event: Payload) => void | Promise<void>>()
  const subscribe: NativeEvent<Payload> = (listener) => {
    listeners.add(listener)
    return { remove: () => listeners.delete(listener) }
  }
  return {
    emit: (event: Payload): void => {
      for (const listener of listeners) void listener(event)
    },
    subscribe,
  }
}

function bridgeFixture() {
  let nextSession = 0
  const bestMove = nativeEvent<NativeStockfishBestMoveMessage>()
  const closed = nativeEvent<NativeStockfishClosedMessage>()
  const failure = nativeEvent<NativeStockfishFailureMessage>()
  const information = nativeEvent<NativeStockfishSearchInformationMessage>()
  const ready = nativeEvent<NativeStockfishReadyMessage>()
  const bridge = {
    boot: vi.fn(),
    close: vi.fn((sessionId: string) => closed.emit({ sessionId })),
    createSession: vi.fn(() => `native-test/${++nextSession}`),
    onBestMove: bestMove.subscribe,
    onClosed: closed.subscribe,
    onFailure: failure.subscribe,
    onReady: ready.subscribe,
    onSearchInformation: information.subscribe,
    startSearch: vi.fn(),
    stop: vi.fn(),
  } satisfies NativeStockfishBridge
  return { bestMove, bridge, closed, failure, information, ready }
}

describe("native session event binding", () => {
  it("routes each command through its allocated session identity", () => {
    const { bridge } = bridgeFixture()
    const first = bindNativeStockfishSession(bridge)
    const second = bindNativeStockfishSession(bridge)
    const request = {
      fen: "8/8/8/8/8/8/4K3/7k w - - 0 1",
      moves: [],
      nodeLimit: 200,
      requestId: "same-request",
    }
    first.startSearch(request)
    second.stop(request.requestId)
    first.close()
    expect(bridge.startSearch).toHaveBeenCalledWith("native-test/1", request)
    expect(bridge.stop).toHaveBeenCalledWith("native-test/2", "same-request")
    expect(bridge.close).toHaveBeenCalledWith("native-test/1")
  })

  it("does not let another session announce readiness or failure", async () => {
    const { bridge, failure, ready } = bridgeFixture()
    const first = new NativeStockfishSession(
      CONFIGURATION,
      bindNativeStockfishSession(bridge),
    )
    const second = new NativeStockfishSession(
      CONFIGURATION,
      bindNativeStockfishSession(bridge),
    )
    const firstBoot = first.boot()
    const secondBoot = second.boot()
    ready.emit({ sessionId: "native-test/2", payload: { version: "18 Lite" } })
    await secondBoot
    expect(first.state()).toBe("booting")
    expect(second.state()).toBe("ready")
    const rejected = expect(firstBoot).rejects.toThrow("failed boot")
    failure.emit({
      sessionId: "native-test/1",
      payload: { code: "test-failure", message: "failed boot", requestId: "" },
    })
    await rejected
    expect(second.state()).toBe("ready")
    await Promise.all([first.close(), second.close()])
  })

  it("isolates identical request IDs and closing traffic across sessions", async () => {
    const { bestMove, bridge, ready } = bridgeFixture()
    const first = new NativeStockfishSession(
      CONFIGURATION,
      bindNativeStockfishSession(bridge),
    )
    const second = new NativeStockfishSession(
      CONFIGURATION,
      bindNativeStockfishSession(bridge),
    )
    const opening = Promise.all([first.boot(), second.boot()])
    for (const sessionId of ["native-test/1", "native-test/2"]) {
      ready.emit({ sessionId, payload: { version: "18 Lite" } })
    }
    await opening
    const request = {
      nodeLimit: 200,
      position: { fen: "8/8/8/8/8/8/4K3/7k w - - 0 1", moves: [] },
      requestId: "same-request",
    }
    const firstResult = first.search(request)
    const secondResult = second.search(request)
    bestMove.emit({
      sessionId: "native-test/2",
      payload: {
        bestMove: "e2e3",
        ponderMove: "",
        requestId: request.requestId,
      },
    })
    await expect(secondResult).resolves.toMatchObject({ bestMove: "e2e3" })
    expect(first.state()).toBe("searching")
    await second.close()
    expect(first.state()).toBe("searching")
    bestMove.emit({
      sessionId: "native-test/1",
      payload: {
        bestMove: "e2d3",
        ponderMove: "",
        requestId: request.requestId,
      },
    })
    await expect(firstResult).resolves.toMatchObject({ bestMove: "e2d3" })
    await first.close()
  })

  it("removes only the owning subscription", () => {
    const { bridge, ready } = bridgeFixture()
    const first = bindNativeStockfishSession(bridge)
    const second = bindNativeStockfishSession(bridge)
    const firstReady = vi.fn()
    const secondReady = vi.fn()
    const subscription = first.onReady(firstReady)
    second.onReady(secondReady)
    subscription.remove()
    ready.emit({ sessionId: "native-test/1", payload: { version: "18 Lite" } })
    ready.emit({ sessionId: "native-test/2", payload: { version: "18 Lite" } })
    expect(firstReady).not.toHaveBeenCalled()
    expect(secondReady).toHaveBeenCalledExactlyOnceWith({ version: "18 Lite" })
  })

  it("rejects malformed session allocation before binding commands", () => {
    const { bridge } = bridgeFixture()
    bridge.createSession.mockReturnValue("")
    expect(() => bindNativeStockfishSession(bridge)).toThrow()
    expect(bridge.boot).not.toHaveBeenCalled()
  })
})

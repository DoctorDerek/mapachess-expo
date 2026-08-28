import { describe, expect, it } from "vitest"
import {
  StockfishOperationAbortedError,
  type StockfishEngineConfiguration,
  type StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import type {
  NativeStockfishBestMoveEvent,
  NativeStockfishConfiguration,
  NativeStockfishFailureEvent,
  NativeStockfishReadyEvent,
  NativeStockfishSearchInformationEvent,
  NativeStockfishSearchRequest,
} from "./NativeMapachessStockfish.js"
import NativeStockfishSession, {
  StockfishNativeSessionError,
  type NativeStockfishModuleBoundary,
} from "./nativeStockfishSession.js"

const CONFIGURATION = {
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: { elo: 1320, kind: "uci-elo" },
  threads: 1,
  variant: "standard",
} as const satisfies StockfishEngineConfiguration

const REQUEST = {
  nodeLimit: 200,
  position: {
    fen: "8/8/8/8/8/8/4K3/7k w - - 0 1",
    moves: [],
  },
  requestId: "game-1/ply-1/white",
} as const satisfies StockfishSearchRequest

type NativeListener<T> = (event: T) => void | Promise<void>

class FakeNativeEvent<T> {
  private readonly listeners = new Set<NativeListener<T>>()

  public readonly subscribe = (listener: NativeListener<T>) => {
    this.listeners.add(listener)
    return { remove: () => this.listeners.delete(listener) }
  }

  public emit(event: T): void {
    for (const listener of this.listeners) void listener(event)
  }

  public listenerCount(): number {
    return this.listeners.size
  }
}

class FakeNativeModule implements NativeStockfishModuleBoundary {
  private readonly bestMoveEvent =
    new FakeNativeEvent<NativeStockfishBestMoveEvent>()
  private readonly closedEvent = new FakeNativeEvent<void>()
  private readonly failureEvent =
    new FakeNativeEvent<NativeStockfishFailureEvent>()
  private readonly readyEvent = new FakeNativeEvent<NativeStockfishReadyEvent>()
  private readonly searchInformationEvent =
    new FakeNativeEvent<NativeStockfishSearchInformationEvent>()

  public readonly bootConfigurations: NativeStockfishConfiguration[] = []
  public readonly searchRequests: NativeStockfishSearchRequest[] = []
  public readonly stopRequestIds: string[] = []
  public bootFailure: unknown = undefined
  public closeCallCount = 0
  public closeFailure: unknown = undefined
  public startSearchFailure: unknown = undefined
  public stopFailure: unknown = undefined

  public readonly onBestMove = this.bestMoveEvent.subscribe
  public readonly onClosed = this.closedEvent.subscribe
  public readonly onFailure = this.failureEvent.subscribe
  public readonly onReady = this.readyEvent.subscribe
  public readonly onSearchInformation = this.searchInformationEvent.subscribe

  public boot(configuration: NativeStockfishConfiguration): void {
    if (this.bootFailure !== undefined) throw this.bootFailure
    this.bootConfigurations.push(configuration)
  }

  public close(): void {
    if (this.closeFailure !== undefined) throw this.closeFailure
    this.closeCallCount += 1
  }

  public startSearch(request: NativeStockfishSearchRequest): void {
    if (this.startSearchFailure !== undefined) throw this.startSearchFailure
    this.searchRequests.push(request)
  }

  public stop(requestId: string): void {
    if (this.stopFailure !== undefined) throw this.stopFailure
    this.stopRequestIds.push(requestId)
  }

  public emitBestMove(event: NativeStockfishBestMoveEvent): void {
    this.bestMoveEvent.emit(event)
  }

  public emitClosed(): void {
    this.closedEvent.emit(undefined)
  }

  public emitFailure(event: NativeStockfishFailureEvent): void {
    this.failureEvent.emit(event)
  }

  public emitReady(version = "Stockfish 18"): void {
    this.readyEvent.emit({ version })
  }

  public emitSearchInformation(
    event: NativeStockfishSearchInformationEvent,
  ): void {
    this.searchInformationEvent.emit(event)
  }

  public subscriptionCounts(): number[] {
    return [
      this.bestMoveEvent.listenerCount(),
      this.closedEvent.listenerCount(),
      this.failureEvent.listenerCount(),
      this.readyEvent.listenerCount(),
      this.searchInformationEvent.listenerCount(),
    ]
  }
}

async function bootFixture(
  configuration: StockfishEngineConfiguration = CONFIGURATION,
): Promise<{
  module: FakeNativeModule
  session: NativeStockfishSession
}> {
  const module = new FakeNativeModule()
  const session = new NativeStockfishSession(configuration, module)
  const boot = session.boot()
  module.emitReady()
  await boot
  return { module, session }
}

function informationEvent(
  overrides: Partial<NativeStockfishSearchInformationEvent> = {},
): NativeStockfishSearchInformationEvent {
  return {
    bound: "",
    centipawns: 34,
    depth: 7,
    mateMoves: 0,
    nodes: 200,
    requestId: REQUEST.requestId,
    scoreKind: "centipawns",
    selectiveDepth: 9,
    ...overrides,
  }
}

describe("Native Stockfish session", () => {
  it("boots with one acknowledged native configuration", async () => {
    const module = new FakeNativeModule()
    const session = new NativeStockfishSession(CONFIGURATION, module)

    const boot = session.boot()
    expect(session.state()).toBe("booting")
    expect(module.bootConfigurations).toEqual([
      {
        elo: 1320,
        hashMegabytes: 16,
        isChess960: false,
        limitStrength: true,
        multiPv: 1,
        ponder: false,
        threads: 1,
      },
    ])
    expect(module.subscriptionCounts()).toEqual([1, 1, 1, 1, 1])

    module.emitReady()
    await expect(boot).resolves.toEqual({
      author: "the Stockfish developers",
      name: "Stockfish 18",
    })
    expect(session.state()).toBe("ready")
  })

  it("maps full-strength Chess960 configuration without a fake Elo", async () => {
    const configuration = {
      ...CONFIGURATION,
      strength: { kind: "full-strength" },
      variant: "chess960",
    } as const satisfies StockfishEngineConfiguration
    const module = new FakeNativeModule()
    const session = new NativeStockfishSession(configuration, module)

    const boot = session.boot()
    expect(module.bootConfigurations[0]).toMatchObject({
      elo: 0,
      isChess960: true,
      limitStrength: false,
    })
    module.emitReady()
    await boot
  })

  it("returns the matching best move and latest typed information", async () => {
    const { module, session } = await bootFixture()

    const search = session.search(REQUEST)
    module.emitSearchInformation(informationEvent({ bound: "lowerbound" }))
    module.emitSearchInformation(informationEvent())
    module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "h1g1",
      requestId: REQUEST.requestId,
    })

    await expect(search).resolves.toEqual({
      bestMove: "e2e3",
      latestInformation: {
        depth: 7,
        nodes: 200,
        score: { bound: "exact", kind: "centipawns", value: 34 },
        selectiveDepth: 9,
      },
      ponderMove: "h1g1",
      requestId: REQUEST.requestId,
    })
    expect(module.searchRequests).toEqual([
      {
        fen: REQUEST.position.fen,
        moves: REQUEST.position.moves,
        nodeLimit: 200,
        requestId: REQUEST.requestId,
      },
    ])
    expect(session.state()).toBe("ready")
  })

  it("maps mate bounds and a position with no legal move", async () => {
    const { module, session } = await bootFixture()
    const search = session.search(REQUEST)

    module.emitSearchInformation(
      informationEvent({
        bound: "upperbound",
        mateMoves: -2,
        scoreKind: "mate",
      }),
    )
    module.emitBestMove({
      bestMove: "(none)",
      ponderMove: "(none)",
      requestId: REQUEST.requestId,
    })

    await expect(search).resolves.toEqual({
      bestMove: null,
      latestInformation: {
        depth: 7,
        nodes: 200,
        score: { bound: "upper", kind: "mate", value: -2 },
        selectiveDepth: 9,
      },
      requestId: REQUEST.requestId,
    })
  })

  it("rejects concurrent and already-aborted searches without native work", async () => {
    const { module, session } = await bootFixture()
    const firstSearch = session.search(REQUEST)
    const aborted = new AbortController()
    aborted.abort()

    await expect(
      session.search({ ...REQUEST, requestId: "concurrent-request" }),
    ).rejects.toThrow("cannot search from state searching")
    expect(module.searchRequests).toHaveLength(1)

    module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "",
      requestId: REQUEST.requestId,
    })
    await firstSearch

    await expect(
      session.search(
        { ...REQUEST, requestId: "already-aborted" },
        aborted.signal,
      ),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(module.searchRequests).toHaveLength(1)
    expect(session.state()).toBe("ready")
  })

  it("drains cancellation before allowing the session to be reused", async () => {
    const { module, session } = await bootFixture()
    const abortController = new AbortController()
    const search = session.search(REQUEST, abortController.signal)

    abortController.abort()
    expect(session.state()).toBe("stopping")
    expect(module.stopRequestIds).toEqual([REQUEST.requestId])
    module.emitSearchInformation(informationEvent({ centipawns: 99 }))
    module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "",
      requestId: REQUEST.requestId,
    })

    await expect(search).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(session.state()).toBe("ready")

    const nextRequest = { ...REQUEST, requestId: "next-request" }
    const nextSearch = session.search(nextRequest)
    module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "",
      requestId: nextRequest.requestId,
    })
    await expect(nextSearch).resolves.toMatchObject({
      requestId: nextRequest.requestId,
    })
  })

  it("fails closed on stale native search information", async () => {
    const { module, session } = await bootFixture()
    const search = session.search(REQUEST)

    module.emitSearchInformation(
      informationEvent({ requestId: "stale-request" }),
    )

    await expect(search).rejects.toMatchObject({
      code: "stale-response",
      requestId: "stale-request",
    })
    expect(session.state()).toBe("failed")
  })

  it("fails closed on stale best moves and invalid native scores", async () => {
    const staleFixture = await bootFixture()
    const staleSearch = staleFixture.session.search(REQUEST)
    staleFixture.module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "",
      requestId: "stale-request",
    })
    await expect(staleSearch).rejects.toBeInstanceOf(
      StockfishNativeSessionError,
    )
    expect(staleFixture.session.state()).toBe("failed")

    const invalidFixture = await bootFixture()
    const invalidSearch = invalidFixture.session.search(REQUEST)
    invalidFixture.module.emitSearchInformation(
      informationEvent({ scoreKind: "unknown" }),
    )
    await expect(invalidSearch).rejects.toMatchObject({
      code: "invalid-search-information",
    })
    expect(invalidFixture.session.state()).toBe("failed")

    const invalidBoundFixture = await bootFixture()
    const invalidBoundSearch = invalidBoundFixture.session.search(REQUEST)
    invalidBoundFixture.module.emitSearchInformation(
      informationEvent({ bound: "approximate" }),
    )
    await expect(invalidBoundSearch).rejects.toMatchObject({
      code: "invalid-search-information",
    })
    expect(invalidBoundFixture.session.state()).toBe("failed")
  })

  it("rejects malformed moves emitted across the native boundary", async () => {
    const invalidBestMoveFixture = await bootFixture()
    const invalidBestMoveSearch = invalidBestMoveFixture.session.search(REQUEST)
    invalidBestMoveFixture.module.emitBestMove({
      bestMove: "E2E3",
      ponderMove: "",
      requestId: REQUEST.requestId,
    })
    await expect(invalidBestMoveSearch).rejects.toThrow(
      "bestMove must be a lowercase UCI move",
    )
    expect(invalidBestMoveFixture.session.state()).toBe("failed")

    const invalidPonderMoveFixture = await bootFixture()
    const invalidPonderMoveSearch =
      invalidPonderMoveFixture.session.search(REQUEST)
    invalidPonderMoveFixture.module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "H1G1",
      requestId: REQUEST.requestId,
    })
    await expect(invalidPonderMoveSearch).rejects.toThrow(
      "ponderMove must be a lowercase UCI move",
    )
    expect(invalidPonderMoveFixture.session.state()).toBe("failed")
  })

  it("propagates native failures with request identity", async () => {
    const { module, session } = await bootFixture()
    const search = session.search(REQUEST)

    module.emitFailure({
      code: "native-engine-error",
      message: "Stockfish failed.",
      requestId: REQUEST.requestId,
    })

    await expect(search).rejects.toEqual(
      new StockfishNativeSessionError(
        "native-engine-error",
        "Stockfish failed.",
        REQUEST.requestId,
      ),
    )
    expect(session.state()).toBe("failed")
  })

  it("rejects stale native failures instead of poisoning another request", async () => {
    const { module, session } = await bootFixture()
    const search = session.search(REQUEST)

    module.emitFailure({
      code: "native-engine-error",
      message: "Old search failed.",
      requestId: "stale-request",
    })

    await expect(search).rejects.toMatchObject({
      code: "stale-response",
      requestId: "stale-request",
    })
    expect(session.state()).toBe("failed")
  })

  it("closes active work, waits for native closure, and removes listeners", async () => {
    const { module, session } = await bootFixture()
    const search = session.search(REQUEST)
    const close = session.close()

    expect(session.state()).toBe("closing")
    expect(module.closeCallCount).toBe(1)
    expect(module.subscriptionCounts()).toEqual([1, 1, 1, 1, 1])

    module.emitBestMove({
      bestMove: "e2e3",
      ponderMove: "",
      requestId: REQUEST.requestId,
    })
    module.emitClosed()

    await expect(search).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    await expect(close).resolves.toBeUndefined()
    expect(session.state()).toBe("closed")
    expect(module.subscriptionCounts()).toEqual([0, 0, 0, 0, 0])
    await expect(session.close()).resolves.toBeUndefined()
    expect(module.closeCallCount).toBe(1)
  })

  it("aborts boot by closing the native owner", async () => {
    const module = new FakeNativeModule()
    const session = new NativeStockfishSession(CONFIGURATION, module)
    const abortController = new AbortController()
    const boot = session.boot(abortController.signal)

    abortController.abort()
    expect(module.closeCallCount).toBe(1)
    module.emitClosed()

    await expect(boot).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(session.state()).toBe("closed")
  })

  it("rejects an explicit close while boot is pending", async () => {
    const module = new FakeNativeModule()
    const session = new NativeStockfishSession(CONFIGURATION, module)
    const boot = session.boot()
    const close = session.close()

    module.emitReady()
    module.emitClosed()

    await expect(boot).rejects.toMatchObject({ code: "closed" })
    await expect(close).resolves.toBeUndefined()
    expect(session.state()).toBe("closed")
  })

  it("rejects invalid readiness and synchronous native boot failures", async () => {
    const invalidModule = new FakeNativeModule()
    const invalidSession = new NativeStockfishSession(
      CONFIGURATION,
      invalidModule,
    )
    const invalidBoot = invalidSession.boot()
    invalidModule.emitReady(" Stockfish 18")
    await expect(invalidBoot).rejects.toBeInstanceOf(TypeError)
    expect(invalidSession.state()).toBe("failed")

    const failedModule = new FakeNativeModule()
    const failure = new Error("Native boot failed.")
    failedModule.bootFailure = failure
    const failedSession = new NativeStockfishSession(
      CONFIGURATION,
      failedModule,
    )
    await expect(failedSession.boot()).rejects.toBe(failure)
    expect(failedSession.state()).toBe("failed")
  })

  it("propagates native boot events before readiness", async () => {
    const module = new FakeNativeModule()
    const session = new NativeStockfishSession(CONFIGURATION, module)
    const boot = session.boot()
    module.emitFailure({
      code: "native-engine-error",
      message: "Embedded network verification failed.",
      requestId: "",
    })

    await expect(boot).rejects.toMatchObject({
      code: "native-engine-error",
      requestId: "",
    })
    expect(session.state()).toBe("failed")
  })

  it("rejects a search if cancellation cannot reach native Stockfish", async () => {
    const { module, session } = await bootFixture()
    const abortController = new AbortController()
    const failure = new Error("Native stop failed.")
    module.stopFailure = failure
    const search = session.search(REQUEST, abortController.signal)

    abortController.abort()

    await expect(search).rejects.toBe(failure)
    expect(session.state()).toBe("failed")
  })

  it("rejects an unexpected native close during an active search", async () => {
    const { module, session } = await bootFixture()
    const search = session.search(REQUEST)

    module.emitClosed()

    await expect(search).rejects.toMatchObject({
      code: "unexpected-close",
      requestId: REQUEST.requestId,
    })
    expect(session.state()).toBe("closed")
  })

  it("reports a closing failure after native teardown completes", async () => {
    const { module, session } = await bootFixture()
    const close = session.close()
    module.emitFailure({
      code: "native-close-error",
      message: "Native close failed.",
      requestId: "",
    })
    module.emitClosed()

    await expect(close).rejects.toMatchObject({ code: "native-close-error" })
    expect(session.state()).toBe("closed")
  })

  it("rejects synchronous native close failures", async () => {
    const { module, session } = await bootFixture()
    const failure = new Error("Native close invocation failed.")
    module.closeFailure = failure

    await expect(session.close()).rejects.toBe(failure)
    expect(session.state()).toBe("failed")
  })

  it("rejects synchronous native search failures", async () => {
    const { module, session } = await bootFixture()
    const failure = new Error("Native start failed.")
    module.startSearchFailure = failure

    await expect(session.search(REQUEST)).rejects.toBe(failure)
    expect(session.state()).toBe("failed")
  })
})

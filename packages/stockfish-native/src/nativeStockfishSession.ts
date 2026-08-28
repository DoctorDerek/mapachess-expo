import {
  StockfishOperationAbortedError,
  type StockfishEngineConfiguration,
  type StockfishEngineIdentity,
  type StockfishEngineSearchInformation,
  type StockfishEngineSearchResult,
  type StockfishEngineSession,
  type StockfishEngineSessionState,
  type StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import {
  assertStableText,
  assertStockfishOperationNotAborted,
  validateStockfishEngineConfiguration,
  validateStockfishSearchRequest,
} from "@mapachess/stockfish/engine-validation"
import type {
  NativeStockfishBestMoveEvent,
  NativeStockfishFailureEvent,
  NativeStockfishReadyEvent,
  NativeStockfishSearchInformationEvent,
} from "./NativeMapachessStockfish.js"
import {
  bestMoveFromNative,
  configurationForNative,
  informationFromNative,
  optionalPonderMove,
  StockfishNativeSessionError,
  type NativeStockfishModuleBoundary,
} from "./nativeStockfishBoundary.js"

export { StockfishNativeSessionError }
export type { NativeStockfishModuleBoundary }

type NativeEventSubscription = Readonly<{ remove: () => void }>

type PendingBoot = Readonly<{
  cleanupAbort: () => void
  reject: (reason: unknown) => void
  resolve: (identity: StockfishEngineIdentity) => void
}>

type ActiveSearch = {
  cancellationRequested: boolean
  cleanupAbort: () => void
  latestInformation?: StockfishEngineSearchInformation
  reject: (reason: unknown) => void
  requestId: string
  resolve: (result: StockfishEngineSearchResult) => void
}

type PendingClose = {
  failure?: StockfishNativeSessionError
  promise: Promise<void>
  reject: (reason: unknown) => void
  resolve: () => void
}

const STOCKFISH_AUTHOR = "the Stockfish developers"

export default class NativeStockfishSession implements StockfishEngineSession {
  private activeSearch: ActiveSearch | undefined
  private pendingBoot: PendingBoot | undefined
  private pendingClose: PendingClose | undefined
  private sessionState: StockfishEngineSessionState = "created"
  private subscriptions: NativeEventSubscription[] = []

  public constructor(
    private readonly configuration: StockfishEngineConfiguration,
    private readonly nativeModule: NativeStockfishModuleBoundary,
  ) {}

  public async boot(signal?: AbortSignal): Promise<StockfishEngineIdentity> {
    validateStockfishEngineConfiguration(this.configuration)
    if (this.sessionState !== "created") {
      return Promise.reject(this.invalidStateError("boot", this.sessionState))
    }
    assertStockfishOperationNotAborted(signal, "boot")

    this.ensureSubscriptions()
    this.sessionState = "booting"

    const promise = new Promise<StockfishEngineIdentity>((resolve, reject) => {
      const onAbort = (): void => {
        if (this.pendingBoot === undefined) return
        this.pendingBoot.cleanupAbort()
        this.pendingBoot = undefined
        reject(new StockfishOperationAbortedError("boot"))
        void this.close().catch(() => undefined)
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      this.pendingBoot = {
        cleanupAbort: () => signal?.removeEventListener("abort", onAbort),
        reject,
        resolve,
      }
    })

    if (signal?.aborted === true) {
      const pendingBoot = this.pendingBoot
      pendingBoot?.cleanupAbort()
      this.pendingBoot = undefined
      pendingBoot?.reject(new StockfishOperationAbortedError("boot"))
      void this.close().catch(() => undefined)
      return promise
    }

    try {
      this.nativeModule.boot(configurationForNative(this.configuration))
    } catch (error) {
      this.rejectBoot(error)
      this.sessionState = "failed"
    }

    return promise
  }

  public close(): Promise<void> {
    if (this.sessionState === "closed") return Promise.resolve()
    if (this.pendingClose !== undefined) return this.pendingClose.promise

    this.ensureSubscriptions()
    this.cancelPendingBootForClose()
    this.markActiveSearchCancelled()
    this.sessionState = "closing"

    let resolveClose: (() => void) | undefined
    let rejectClose: ((reason: unknown) => void) | undefined
    const promise = new Promise<void>((resolve, reject) => {
      resolveClose = resolve
      rejectClose = reject
    })
    this.pendingClose = {
      promise,
      reject: (reason) => rejectClose?.(reason),
      resolve: () => resolveClose?.(),
    }

    try {
      this.nativeModule.close()
    } catch (error) {
      this.pendingClose = undefined
      this.sessionState = "failed"
      rejectClose?.(error)
    }

    return promise
  }

  public async search(
    request: StockfishSearchRequest,
    signal?: AbortSignal,
  ): Promise<StockfishEngineSearchResult> {
    validateStockfishSearchRequest(request)
    if (this.sessionState !== "ready") {
      return Promise.reject(this.invalidStateError("search", this.sessionState))
    }
    assertStockfishOperationNotAborted(
      signal,
      `search request ${request.requestId}`,
    )

    this.sessionState = "searching"
    const promise = new Promise<StockfishEngineSearchResult>(
      (resolve, reject) => {
        const onAbort = (): void => this.requestSearchCancellation(request)
        signal?.addEventListener("abort", onAbort, { once: true })
        this.activeSearch = {
          cancellationRequested: false,
          cleanupAbort: () => signal?.removeEventListener("abort", onAbort),
          reject,
          requestId: request.requestId,
          resolve,
        }
      },
    )

    try {
      this.nativeModule.startSearch({
        fen: request.position.fen,
        moves: request.position.moves,
        nodeLimit: request.nodeLimit,
        requestId: request.requestId,
      })
      if (signal?.aborted === true) this.requestSearchCancellation(request)
    } catch (error) {
      this.failActiveSearch(error)
    }

    return promise
  }

  public state(): StockfishEngineSessionState {
    return this.sessionState
  }

  private ensureSubscriptions(): void {
    if (this.subscriptions.length > 0) return

    this.subscriptions = [
      this.nativeModule.onBestMove((event) => this.receiveBestMove(event)),
      this.nativeModule.onClosed(() => this.receiveClosed()),
      this.nativeModule.onFailure((event) => this.receiveFailure(event)),
      this.nativeModule.onReady((event) => this.receiveReady(event)),
      this.nativeModule.onSearchInformation((event) =>
        this.receiveSearchInformation(event),
      ),
    ]
  }

  private removeSubscriptions(): void {
    for (const subscription of this.subscriptions) subscription.remove()
    this.subscriptions = []
  }

  private receiveReady(event: NativeStockfishReadyEvent): void {
    if (this.sessionState === "closing" || this.sessionState === "closed") {
      return
    }

    if (this.sessionState !== "booting" || this.pendingBoot === undefined) {
      this.sessionState = "failed"
      this.rejectBoot(
        new StockfishNativeSessionError(
          "unexpected-ready",
          "The native engine emitted readiness outside boot.",
        ),
      )
      return
    }

    try {
      assertStableText(event.version, "native engine version")
    } catch (error) {
      this.rejectBoot(error)
      this.sessionState = "failed"
      return
    }

    const pendingBoot = this.pendingBoot
    pendingBoot.cleanupAbort()
    this.pendingBoot = undefined
    this.sessionState = "ready"
    pendingBoot.resolve({ author: STOCKFISH_AUTHOR, name: event.version })
  }

  private receiveSearchInformation(
    event: NativeStockfishSearchInformationEvent,
  ): void {
    const activeSearch = this.activeSearch
    if (activeSearch === undefined || activeSearch.cancellationRequested) return

    if (event.requestId !== activeSearch.requestId) {
      this.failActiveSearch(
        new StockfishNativeSessionError(
          "stale-response",
          `Rejected native Stockfish information for stale request ${event.requestId}.`,
          event.requestId,
        ),
      )
      return
    }

    try {
      activeSearch.latestInformation = informationFromNative(event)
    } catch (error) {
      this.failActiveSearch(error)
    }
  }

  private receiveBestMove(event: NativeStockfishBestMoveEvent): void {
    const activeSearch = this.activeSearch
    if (activeSearch === undefined) {
      if (
        this.sessionState !== "closing" &&
        this.sessionState !== "closed" &&
        this.sessionState !== "failed"
      ) {
        this.sessionState = "failed"
      }
      return
    }

    if (event.requestId !== activeSearch.requestId) {
      this.failActiveSearch(
        new StockfishNativeSessionError(
          "stale-response",
          `Rejected native Stockfish result for stale request ${event.requestId}.`,
          event.requestId,
        ),
      )
      return
    }

    activeSearch.cleanupAbort()
    this.activeSearch = undefined
    if (this.sessionState !== "closing") this.sessionState = "ready"

    if (activeSearch.cancellationRequested) {
      activeSearch.reject(
        new StockfishOperationAbortedError(
          `search request ${activeSearch.requestId}`,
        ),
      )
      return
    }

    try {
      const ponderMove = optionalPonderMove(event.ponderMove)
      activeSearch.resolve({
        bestMove: bestMoveFromNative(event.bestMove),
        requestId: activeSearch.requestId,
        ...(ponderMove === undefined ? {} : { ponderMove }),
        ...(activeSearch.latestInformation === undefined
          ? {}
          : { latestInformation: activeSearch.latestInformation }),
      })
    } catch (error) {
      this.sessionState = "failed"
      activeSearch.reject(error)
    }
  }

  private receiveFailure(event: NativeStockfishFailureEvent): void {
    const nativeFailure = new StockfishNativeSessionError(
      event.code,
      event.message,
      event.requestId,
    )
    this.rejectBoot(nativeFailure)

    if (this.activeSearch !== undefined) {
      const failure =
        event.requestId === "" ||
        event.requestId === this.activeSearch.requestId
          ? nativeFailure
          : new StockfishNativeSessionError(
              "stale-response",
              `The native failure belonged to stale request ${event.requestId}.`,
              event.requestId,
            )
      this.failActiveSearch(failure)
    }

    if (this.pendingClose !== undefined) {
      this.pendingClose.failure = nativeFailure
    }
    if (this.sessionState !== "closing" && this.sessionState !== "closed") {
      this.sessionState = "failed"
    }
  }

  private receiveClosed(): void {
    this.rejectBoot(
      new StockfishNativeSessionError(
        "unexpected-close",
        "The native engine closed before boot completed.",
      ),
    )
    if (this.activeSearch !== undefined) {
      const activeSearch = this.activeSearch
      activeSearch.cleanupAbort()
      this.activeSearch = undefined
      activeSearch.reject(
        activeSearch.cancellationRequested
          ? new StockfishOperationAbortedError(
              `search request ${activeSearch.requestId}`,
            )
          : new StockfishNativeSessionError(
              "unexpected-close",
              "The native engine closed before the search completed.",
              activeSearch.requestId,
            ),
      )
    }

    const pendingClose = this.pendingClose
    this.pendingClose = undefined
    this.sessionState = "closed"
    this.removeSubscriptions()
    if (pendingClose?.failure === undefined) pendingClose?.resolve()
    else pendingClose.reject(pendingClose.failure)
  }

  private requestSearchCancellation(request: StockfishSearchRequest): void {
    const activeSearch = this.activeSearch
    if (
      activeSearch === undefined ||
      activeSearch.requestId !== request.requestId ||
      activeSearch.cancellationRequested
    ) {
      return
    }

    activeSearch.cancellationRequested = true
    this.sessionState = "stopping"
    try {
      this.nativeModule.stop(request.requestId)
    } catch (error) {
      this.failActiveSearch(error)
    }
  }

  private markActiveSearchCancelled(): void {
    if (this.activeSearch === undefined) return
    this.activeSearch.cancellationRequested = true
    this.activeSearch.cleanupAbort()
  }

  private cancelPendingBootForClose(): void {
    if (this.pendingBoot === undefined) return
    const pendingBoot = this.pendingBoot
    pendingBoot.cleanupAbort()
    this.pendingBoot = undefined
    pendingBoot.reject(
      new StockfishNativeSessionError(
        "closed",
        "The native engine was closed during boot.",
      ),
    )
  }

  private rejectBoot(reason: unknown): void {
    if (this.pendingBoot === undefined) return
    const pendingBoot = this.pendingBoot
    pendingBoot.cleanupAbort()
    this.pendingBoot = undefined
    pendingBoot.reject(reason)
  }

  private failActiveSearch(reason: unknown): void {
    const activeSearch = this.activeSearch
    if (activeSearch === undefined) return
    activeSearch.cleanupAbort()
    this.activeSearch = undefined
    this.sessionState = "failed"
    activeSearch.reject(reason)
  }

  private invalidStateError(
    operation: "boot" | "search",
    state: StockfishEngineSessionState,
  ): StockfishNativeSessionError {
    return new StockfishNativeSessionError(
      "invalid-state",
      `Stockfish cannot ${operation} from state ${state}.`,
    )
  }
}

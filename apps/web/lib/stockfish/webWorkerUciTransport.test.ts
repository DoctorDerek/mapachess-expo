import { afterEach, describe, expect, it, vi } from "vitest"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import createStockfishUciSession from "@mapachess/stockfish/uci-session"
import { STOCKFISH_18_WEB_UCI_EXPECTATION } from "@mapachess/stockfish/web-runtime-identity"
import createWebStockfishSession, {
  STOCKFISH_WEB_WORKER_NAME,
  STOCKFISH_WEB_WORKER_URL,
} from "./createWebStockfishSession"
import createWebWorkerUciTransport, {
  type StockfishWebWorker,
} from "./webWorkerUciTransport"

const STANDARD_FEN = "8/8/8/8/8/4k3/8/4K3 w - - 0 1"
const STANDARD_CONFIGURATION = {
  variant: "standard",
  strength: { kind: "full-strength" },
  threads: 1,
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
} satisfies StockfishEngineConfiguration
const UCI_OPTIONS = [
  "option name Threads type spin default 1 min 1 max 1",
  "option name Hash type spin default 16 min 1 max 33554432",
  "option name Clear Hash type button",
  "option name Ponder type check default false",
  "option name MultiPV type spin default 1 min 1 max 256",
  "option name Skill Level type spin default 20 min 0 max 20",
  "option name Move Overhead type spin default 10 min 0 max 5000",
  "option name nodestime type spin default 0 min 0 max 10000",
  "option name UCI_Chess960 type check default false",
  "option name UCI_LimitStrength type check default false",
  "option name UCI_Elo type spin default 1320 min 1320 max 3190",
  "option name UCI_ShowWDL type check default false",
  "option name EvalFile type string default nn-9067e33176e8.nnue",
  "option name EvalFileSmall type string default <empty>",
] as const

class FakeMessageEvent extends Event {
  public constructor(public readonly data: unknown) {
    super("message")
  }
}

class FakeWorkerErrorEvent extends Event {
  public readonly colno = 9
  public readonly filename = "stockfish-18-lite-single.js"
  public readonly lineno = 27
  public readonly message = "worker fixture failed"

  public constructor() {
    super("error", { cancelable: true })
  }
}

type FakeWorkerBehavior = "engine" | "error" | "non-string"

class FakeStockfishWorker extends EventTarget implements StockfishWebWorker {
  public readonly commands: string[] = []
  public terminated = false
  public preventedWorkerError = false

  public constructor(private readonly behavior: FakeWorkerBehavior = "engine") {
    super()
  }

  public postMessage(message: string): void {
    this.commands.push(message)

    if (message === "uci") {
      if (this.behavior === "error") {
        const error = new FakeWorkerErrorEvent()
        this.dispatchEvent(error)
        this.preventedWorkerError = error.defaultPrevented
        return
      }
      if (this.behavior === "non-string") {
        this.dispatchEvent(new FakeMessageEvent({ unexpected: true }))
        return
      }

      this.emitLines(
        "id name Stockfish 18 Lite WASM",
        "id author the Stockfish developers (see AUTHORS file)",
        ...UCI_OPTIONS,
        "uciok",
      )
    } else if (message === "isready") {
      this.emitLines("readyok")
    } else if (message.startsWith("go nodes ")) {
      this.emitLines(
        "info depth 5 seldepth 7 score cp 18 nodes 100 pv e1e2",
        "bestmove e1e2",
      )
    }
  }

  public terminate(): void {
    this.terminated = true
  }

  private emitLines(...lines: readonly string[]): void {
    this.dispatchEvent(new FakeMessageEvent(lines.join("\n")))
  }
}

function createSession(worker: FakeStockfishWorker) {
  return createStockfishUciSession({
    configuration: STANDARD_CONFIGURATION,
    expectedIdentity: STOCKFISH_18_WEB_UCI_EXPECTATION,
    transport: createWebWorkerUciTransport(worker),
  })
}

describe("Stockfish web Worker transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("constructs the dedicated Worker and deterministically terminates", async () => {
    let constructedWorker: FakeStockfishWorker | undefined
    let constructedUrl: string | URL | undefined
    let constructedOptions: WorkerOptions | undefined

    class ConstructedFakeWorker extends FakeStockfishWorker {
      public constructor(url: string | URL, options?: WorkerOptions) {
        super()
        constructedWorker = this
        constructedUrl = url
        constructedOptions = options
      }
    }

    vi.stubGlobal("Worker", ConstructedFakeWorker)
    const session = createWebStockfishSession(STANDARD_CONFIGURATION, {
      workerName: "mapachess-stockfish-18-hints-test",
    })
    if (constructedWorker === undefined) {
      throw new Error("Expected the web session to construct a Worker.")
    }

    await expect(session.boot()).resolves.toMatchObject({
      name: "Stockfish 18 Lite WASM",
    })
    await expect(
      session.search({
        requestId: "web-worker-search",
        nodeLimit: 100,
        position: { fen: STANDARD_FEN, moves: [] },
      }),
    ).resolves.toMatchObject({
      requestId: "web-worker-search",
      bestMove: "e1e2",
      informationLineCount: 1,
    })
    await session.close()

    expect(constructedUrl).toBe(STOCKFISH_WEB_WORKER_URL)
    expect(constructedOptions).toEqual({
      name: "mapachess-stockfish-18-hints-test",
    })
    expect(constructedWorker.commands.at(-1)).toBe("quit")
    expect(constructedWorker.commands).not.toContain(
      "setoption name SyzygyPath value <empty>",
    )
    expect(constructedWorker.terminated).toBe(true)
    expect(session.state()).toBe("closed")
    expect(STOCKFISH_WEB_WORKER_URL).toBe(
      "/stockfish-runtime/stockfish-18-lite-single.js",
    )
    expect(STOCKFISH_WEB_WORKER_NAME).toBe("mapachess-stockfish-18")
  })

  it("turns a Worker error into a failed and terminated session", async () => {
    const worker = new FakeStockfishWorker("error")
    const session = createSession(worker)

    await expect(session.boot()).rejects.toThrow(
      "worker fixture failed at stockfish-18-lite-single.js:27:9",
    )
    expect(worker.preventedWorkerError).toBe(true)
    expect(worker.terminated).toBe(true)
    expect(session.state()).toBe("failed")
  })

  it("rejects non-string Worker messages without leaking the Worker", async () => {
    const worker = new FakeStockfishWorker("non-string")
    const session = createSession(worker)

    await expect(session.boot()).rejects.toThrow(
      "Worker emitted a non-string object message",
    )
    expect(worker.terminated).toBe(true)
    expect(session.state()).toBe("failed")
  })
})

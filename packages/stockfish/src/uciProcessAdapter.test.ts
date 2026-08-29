import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseSha256Hex, STOCKFISH_18_BUILD_IDENTITY } from "./buildIdentity"
import { StockfishOperationAbortedError } from "./engineSession"
import createStockfishProcessAdapter from "./uciProcessAdapter"
import createStockfishUciSession, {
  StockfishProtocolError,
  type StockfishUciTransport,
  type StockfishUciTransportExit,
} from "./uciSession"

const STANDARD_FEN = "8/8/8/8/8/4k3/8/4K3 w - - 0 1"
const UCI_OPTIONS = [
  "option name Threads type spin default 1 min 1 max 1024",
  "option name Hash type spin default 16 min 1 max 33554432",
  "option name Clear Hash type button",
  "option name Ponder type check default false",
  "option name MultiPV type spin default 1 min 1 max 256",
  "option name UCI_Chess960 type check default false",
  "option name UCI_LimitStrength type check default false",
  "option name UCI_Elo type spin default 1320 min 1320 max 3190",
  "option name SyzygyPath type string default <empty>",
  "option name EvalFile type string default nn-c288c895ea92.nnue",
  "option name EvalFileSmall type string default nn-37f18f62d772.nnue",
] as const

const STANDARD_CONFIGURATION = {
  variant: "standard",
  strength: { kind: "uci-elo", elo: 1320 },
  threads: 1,
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
} as const

const STOCKFISH_18_UCI_EXPECTATION = {
  name: "Stockfish 18",
  networkDefaults: {
    big: "nn-c288c895ea92.nnue",
    small: "nn-37f18f62d772.nnue",
  },
  requiresSyzygyPath: true,
} as const

class AsyncLineQueue implements AsyncIterable<string> {
  readonly #lines: string[] = []
  readonly #waiters: Array<(result: IteratorResult<string>) => void> = []
  #closed = false

  public push(...lines: readonly string[]): void {
    for (const line of lines) {
      const waiter = this.#waiters.shift()
      if (waiter === undefined) this.#lines.push(line)
      else waiter({ done: false, value: line })
    }
  }

  public close(): void {
    this.#closed = true
    for (const waiter of this.#waiters.splice(0)) {
      waiter({ done: true, value: undefined })
    }
  }

  public [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: () => {
        const line = this.#lines.shift()
        if (line !== undefined) {
          return Promise.resolve({ done: false, value: line })
        }

        if (this.#closed) {
          return Promise.resolve({ done: true, value: undefined })
        }

        return new Promise((resolveNext) => this.#waiters.push(resolveNext))
      },
    }
  }
}

type FakeTransportOptions = Readonly<{
  deferBestMove?: boolean
  omitOption?: string
}>

class FakeTransport implements StockfishUciTransport {
  public readonly commands: string[] = []
  public readonly lines = new AsyncLineQueue()
  public terminated = false
  readonly #commandWaiters: Array<{
    command: string
    count: number
    resolve: () => void
  }> = []
  readonly #deferBestMove: boolean
  readonly #omitOption: string | undefined
  readonly #exit: Promise<StockfishUciTransportExit>
  #resolveExit: ((result: StockfishUciTransportExit) => void) | undefined

  public constructor(options: FakeTransportOptions = {}) {
    this.#deferBestMove = options.deferBestMove ?? false
    this.#omitOption = options.omitOption
    this.#exit = new Promise((resolveExit) => {
      this.#resolveExit = resolveExit
    })
  }

  public diagnosticText(): string {
    return ""
  }

  public waitForExit(): Promise<StockfishUciTransportExit> {
    return this.#exit
  }

  public async writeLine(line: string): Promise<void> {
    this.commands.push(line)
    for (const waiter of [...this.#commandWaiters]) {
      const count = this.commands.filter(
        (command) => command === waiter.command,
      ).length
      if (count < waiter.count) continue

      this.#commandWaiters.splice(this.#commandWaiters.indexOf(waiter), 1)
      waiter.resolve()
    }

    if (line === "uci") {
      this.lines.push(
        "id name Stockfish 18",
        "id author the Stockfish developers",
        ...UCI_OPTIONS.filter(
          (option) => !option.includes(this.#omitOption ?? "\0"),
        ),
        "uciok",
      )
    } else if (line === "isready") {
      this.lines.push("readyok")
    } else if (line.startsWith("go nodes ") && !this.#deferBestMove) {
      this.releaseBestMove()
    } else if (line === "quit") {
      this.finish({ code: 0, signal: null })
    }
  }

  public waitForCommandCount(command: string, count: number): Promise<void> {
    const currentCount = this.commands.filter(
      (writtenCommand) => writtenCommand === command,
    ).length
    if (currentCount >= count) return Promise.resolve()

    return new Promise((resolve) => {
      this.#commandWaiters.push({ command, count, resolve })
    })
  }

  public releaseBestMove(): void {
    this.lines.push(
      "info depth 7 seldepth 9 score cp 34 nodes 200 nps 10000 pv e1e2",
      "bestmove e1e2 ponder e3e4",
    )
  }

  public async terminate(): Promise<void> {
    this.terminated = true
    this.finish({ code: null, signal: "SIGTERM" })
  }

  private finish(result: StockfishUciTransportExit): void {
    this.lines.close()
    this.#resolveExit?.(result)
    this.#resolveExit = undefined
  }
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

async function createFixture(
  transport: FakeTransport,
): Promise<ReturnType<typeof createStockfishProcessAdapter>> {
  const directory = await mkdtemp(join(tmpdir(), "mapachess-uci-test-"))
  temporaryDirectories.push(directory)
  const executablePath = join(directory, "stockfish-fixture")
  const executable = Buffer.from("fake executable", "utf8")
  await writeFile(executablePath, executable)
  const identity = {
    ...STOCKFISH_18_BUILD_IDENTITY,
    executableSha256: parseSha256Hex(
      createHash("sha256").update(executable).digest("hex"),
    ),
  }

  return createStockfishProcessAdapter({
    executablePath,
    expectedIdentity: identity,
    configuration: STANDARD_CONFIGURATION,
    transport,
  })
}

describe("Stockfish UCI session", () => {
  it("owns the complete engine lifecycle without a process dependency", async () => {
    const transport = new FakeTransport()
    const session = createStockfishUciSession({
      configuration: STANDARD_CONFIGURATION,
      expectedIdentity: STOCKFISH_18_UCI_EXPECTATION,
      transport,
    })

    await expect(session.boot()).resolves.toMatchObject({
      name: "Stockfish 18",
    })
    await expect(
      session.search({
        requestId: "transport-neutral-search",
        nodeLimit: 200,
        position: { fen: STANDARD_FEN, moves: [] },
      }),
    ).resolves.toMatchObject({
      requestId: "transport-neutral-search",
      bestMove: "e1e2",
    })
    await session.close()

    expect(session.state()).toBe("closed")
    expect(transport.commands.at(-1)).toBe("quit")
  })
})

describe("Stockfish process adapter", () => {
  it("boots through explicit readiness barriers and returns owned search evidence", async () => {
    const transport = new FakeTransport()
    const adapter = await createFixture(transport)

    const identity = await adapter.boot()
    const result = await adapter.search({
      requestId: "game-1/ply-1/white",
      nodeLimit: 200,
      position: { fen: STANDARD_FEN, moves: [] },
    })
    await adapter.close()

    expect(identity.name).toBe("Stockfish 18")
    expect(result).toEqual({
      requestId: "game-1/ply-1/white",
      bestMove: "e1e2",
      ponderMove: "e3e4",
      informationLineCount: 1,
      latestInformation: {
        line: "info depth 7 seldepth 9 score cp 34 nodes 200 nps 10000 pv e1e2",
        depth: 7,
        selectiveDepth: 9,
        nodes: 200,
        score: { kind: "centipawns", value: 34, bound: "exact" },
        principalVariation: ["e1e2"],
      },
      principalVariations: [
        {
          rank: 1,
          moves: ["e1e2"],
          depth: 7,
          selectiveDepth: 9,
          nodes: 200,
          score: { kind: "centipawns", value: 34, bound: "exact" },
        },
      ],
    })
    expect(transport.commands).toEqual([
      "uci",
      "setoption name Threads value 1",
      "setoption name Hash value 16",
      "setoption name MultiPV value 1",
      "setoption name Ponder value false",
      "setoption name UCI_Chess960 value false",
      "setoption name SyzygyPath value <empty>",
      "setoption name UCI_LimitStrength value true",
      "setoption name UCI_Elo value 1320",
      "setoption name Clear Hash",
      "isready",
      "ucinewgame",
      "isready",
      `position fen ${STANDARD_FEN}`,
      "go nodes 200",
      "quit",
    ])
    expect(adapter.state()).toBe("closed")
  })

  it("retains the latest principal variation for every ranked root move", async () => {
    const transport = new FakeTransport({ deferBestMove: true })
    const session = createStockfishUciSession({
      configuration: { ...STANDARD_CONFIGURATION, multiPv: 2 },
      expectedIdentity: STOCKFISH_18_UCI_EXPECTATION,
      transport,
    })
    await session.boot()

    const search = session.search({
      requestId: "ranked-root-moves",
      nodeLimit: 200,
      position: { fen: STANDARD_FEN, moves: [] },
    })
    await transport.waitForCommandCount("go nodes 200", 1)
    transport.lines.push(
      "info depth 5 seldepth 7 multipv 2 score cp 12 nodes 100 pv e1d1 e3d3",
      "info depth 5 seldepth 7 multipv 1 score cp 34 nodes 100 pv e1e2 e3e4",
      "info depth 7 seldepth 9 multipv 1 score cp 38 nodes 200 pv e1f1 e3f3",
      "info string a diagnostic may contain the word pv without being a variation",
      "info depth 8 nodes 200",
      "bestmove e1f1",
    )

    await expect(search).resolves.toEqual({
      requestId: "ranked-root-moves",
      bestMove: "e1f1",
      informationLineCount: 5,
      latestInformation: {
        line: "info depth 8 nodes 200",
        depth: 8,
        nodes: 200,
      },
      principalVariations: [
        {
          rank: 1,
          moves: ["e1f1", "e3f3"],
          depth: 7,
          selectiveDepth: 9,
          nodes: 200,
          score: { kind: "centipawns", value: 38, bound: "exact" },
        },
        {
          rank: 2,
          moves: ["e1d1", "e3d3"],
          depth: 5,
          selectiveDepth: 7,
          nodes: 100,
          score: { kind: "centipawns", value: 12, bound: "exact" },
        },
      ],
    })
    await session.close()
  })

  it.each([
    "info depth 5 multipv 0 score cp 34 nodes 100 pv e1e2",
    "info depth 5 multipv 1 score cp 34 nodes 100 pv invalid",
    "info depth 5 multipv 1 score cp 34 nodes 100 pv",
  ])("rejects malformed ranked search information: %s", async (line) => {
    const transport = new FakeTransport({ deferBestMove: true })
    const session = createStockfishUciSession({
      configuration: STANDARD_CONFIGURATION,
      expectedIdentity: STOCKFISH_18_UCI_EXPECTATION,
      transport,
    })
    await session.boot()

    const search = session.search({
      requestId: "malformed-ranked-information",
      nodeLimit: 200,
      position: { fen: STANDARD_FEN, moves: [] },
    })
    await transport.waitForCommandCount("go nodes 200", 1)
    transport.lines.push(line)

    await expect(search).rejects.toBeInstanceOf(StockfishProtocolError)
    expect(session.state()).toBe("failed")
    expect(transport.terminated).toBe(true)
  })

  it("keeps SyzygyPath mandatory for the native runtime", async () => {
    const transport = new FakeTransport({ omitOption: "SyzygyPath" })
    const adapter = await createFixture(transport)

    await expect(adapter.boot()).rejects.toThrow(
      "did not advertise required UCI option SyzygyPath",
    )
    expect(adapter.state()).toBe("failed")
    expect(transport.terminated).toBe(true)
  })

  it("rejects concurrent searches without disturbing the owned request", async () => {
    const transport = new FakeTransport({ deferBestMove: true })
    const adapter = await createFixture(transport)
    await adapter.boot()

    const firstSearch = adapter.search({
      requestId: "owned-request",
      nodeLimit: 200,
      position: { fen: STANDARD_FEN, moves: [] },
    })
    await expect(
      adapter.search({
        requestId: "concurrent-request",
        nodeLimit: 200,
        position: { fen: STANDARD_FEN, moves: [] },
      }),
    ).rejects.toThrow("cannot search from state searching")

    transport.releaseBestMove()
    await expect(firstSearch).resolves.toMatchObject({
      requestId: "owned-request",
      bestMove: "e1e2",
    })
    await adapter.close()
  })

  it("drains a cancelled search and reuses the same session", async () => {
    const transport = new FakeTransport({ deferBestMove: true })
    const adapter = await createFixture(transport)
    const abortController = new AbortController()
    await adapter.boot()

    const search = adapter.search(
      {
        requestId: "cancelled-request",
        nodeLimit: 200,
        position: { fen: STANDARD_FEN, moves: [] },
      },
      abortController.signal,
    )
    abortController.abort()

    await transport.waitForCommandCount("stop", 1)
    expect(adapter.state()).toBe("stopping")
    expect(transport.terminated).toBe(false)
    transport.releaseBestMove()
    await expect(search).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(adapter.state()).toBe("ready")

    const nextSearch = adapter.search({
      requestId: "after-cancel",
      nodeLimit: 200,
      position: { fen: STANDARD_FEN, moves: [] },
    })
    await transport.waitForCommandCount("go nodes 200", 2)
    transport.releaseBestMove()

    await expect(nextSearch).resolves.toMatchObject({
      requestId: "after-cancel",
      bestMove: "e1e2",
      informationLineCount: 1,
    })
    expect(transport.commands.filter((command) => command === "stop")).toEqual([
      "stop",
    ])
    await adapter.close()
  })

  it("leaves a ready session untouched by an already-aborted search", async () => {
    const transport = new FakeTransport()
    const adapter = await createFixture(transport)
    const abortController = new AbortController()
    await adapter.boot()
    abortController.abort()

    await expect(
      adapter.search(
        {
          requestId: "already-aborted",
          nodeLimit: 200,
          position: { fen: STANDARD_FEN, moves: [] },
        },
        abortController.signal,
      ),
    ).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    expect(adapter.state()).toBe("ready")
    expect(transport.commands).not.toContain("stop")
    await adapter.close()
  })

  it("rejects a binary mismatch before creating a process", async () => {
    const transport = new FakeTransport()
    const directory = await mkdtemp(join(tmpdir(), "mapachess-wrong-uci-test-"))
    temporaryDirectories.push(directory)
    const executablePath = join(directory, "wrong-stockfish")
    await writeFile(executablePath, "wrong executable", "utf8")

    const wrongAdapter = createStockfishProcessAdapter({
      executablePath,
      expectedIdentity: STOCKFISH_18_BUILD_IDENTITY,
      configuration: {
        ...STANDARD_CONFIGURATION,
        strength: { kind: "full-strength" },
      },
      transport,
    })

    await expect(wrongAdapter.boot()).rejects.toThrow(
      "executable SHA-256 mismatch",
    )
    expect(transport.commands).toEqual([])
  })
})

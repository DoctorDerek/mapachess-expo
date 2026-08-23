import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createStockfish18BuildIdentity, parseSha256Hex } from "./buildIdentity"
import createStockfishProcessAdapter, {
  StockfishOperationAbortedError,
  type StockfishProcessExit,
  type StockfishUciTransport,
} from "./uciProcessAdapter"

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
  readonly #deferBestMove: boolean
  readonly #omitOption: string | undefined
  readonly #exit: Promise<StockfishProcessExit>
  #resolveExit: ((result: StockfishProcessExit) => void) | undefined

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

  public waitForExit(): Promise<StockfishProcessExit> {
    return this.#exit
  }

  public async writeLine(line: string): Promise<void> {
    this.commands.push(line)

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

  private finish(result: StockfishProcessExit): void {
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
    ...createStockfish18BuildIdentity("windows-x64"),
    executableSha256: parseSha256Hex(
      createHash("sha256").update(executable).digest("hex"),
    ),
  }

  return createStockfishProcessAdapter({
    executablePath,
    expectedIdentity: identity,
    configuration: {
      variant: "standard",
      strength: { kind: "uci-elo", elo: 1320 },
      threads: 1,
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
    },
    transport,
  })
}

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
      },
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

  it("terminates a process that omits a required option", async () => {
    const transport = new FakeTransport({ omitOption: "EvalFileSmall" })
    const adapter = await createFixture(transport)

    await expect(adapter.boot()).rejects.toThrow(
      "did not advertise required UCI option EvalFileSmall",
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

  it("terminates and permanently rejects a cancelled session", async () => {
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

    await expect(search).rejects.toBeInstanceOf(StockfishOperationAbortedError)
    transport.releaseBestMove()
    expect(transport.terminated).toBe(true)
    expect(adapter.state()).toBe("failed")
    await expect(
      adapter.search({
        requestId: "after-cancel",
        nodeLimit: 200,
        position: { fen: STANDARD_FEN, moves: [] },
      }),
    ).rejects.toThrow("cannot search from state failed")
  })

  it("rejects a binary mismatch before creating a process", async () => {
    const transport = new FakeTransport()
    const directory = await mkdtemp(join(tmpdir(), "mapachess-wrong-uci-test-"))
    temporaryDirectories.push(directory)
    const executablePath = join(directory, "wrong-stockfish")
    await writeFile(executablePath, "wrong executable", "utf8")

    const wrongAdapter = createStockfishProcessAdapter({
      executablePath,
      expectedIdentity: createStockfish18BuildIdentity("windows-x64"),
      configuration: {
        variant: "standard",
        strength: { kind: "full-strength" },
        threads: 1,
        hashMegabytes: 16,
        multiPv: 1,
        ponder: false,
      },
      transport,
    })

    await expect(wrongAdapter.boot()).rejects.toThrow(
      "executable SHA-256 mismatch",
    )
    expect(transport.commands).toEqual([])
  })
})

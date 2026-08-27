import {
  StockfishProtocolError,
  type StockfishUciTransport,
  type StockfishUciTransportExit,
} from "@mapachess/stockfish/uci-session"

const MAX_DIAGNOSTIC_CHARACTERS = 4_096

export type StockfishWebWorker = Readonly<{
  addEventListener: EventTarget["addEventListener"]
  postMessage(message: string): void
  removeEventListener: EventTarget["removeEventListener"]
  terminate(): void
}>

class WorkerLineQueue implements AsyncIterable<string> {
  readonly #lines: string[] = []
  readonly #waiters: Array<{
    reject: (reason?: unknown) => void
    resolve: (result: IteratorResult<string>) => void
  }> = []
  #closed = false
  #failure: Error | undefined

  public push(line: string): void {
    if (this.#closed || this.#failure !== undefined) return

    const waiter = this.#waiters.shift()
    if (waiter === undefined) this.#lines.push(line)
    else waiter.resolve({ done: false, value: line })
  }

  public fail(error: Error): void {
    if (this.#closed || this.#failure !== undefined) return

    this.#failure = error
    for (const waiter of this.#waiters.splice(0)) waiter.reject(error)
  }

  public close(): void {
    if (this.#closed) return

    this.#closed = true
    for (const waiter of this.#waiters.splice(0)) {
      waiter.resolve({ done: true, value: undefined })
    }
  }

  public [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: () => {
        const line = this.#lines.shift()
        if (line !== undefined) {
          return Promise.resolve({ done: false, value: line })
        }
        if (this.#failure !== undefined) {
          return Promise.reject(this.#failure)
        }
        if (this.#closed) {
          return Promise.resolve({ done: true, value: undefined })
        }

        return new Promise((resolve, reject) => {
          this.#waiters.push({ resolve, reject })
        })
      },
    }
  }
}

function workerErrorMessage(event: Event): string {
  const message =
    "message" in event && typeof event.message === "string"
      ? event.message.trim()
      : ""
  const filename =
    "filename" in event && typeof event.filename === "string"
      ? event.filename
      : undefined
  const lineNumber =
    "lineno" in event && typeof event.lineno === "number" ? event.lineno : 0
  const columnNumber =
    "colno" in event && typeof event.colno === "number" ? event.colno : 0
  const location =
    filename === undefined
      ? ""
      : ` at ${filename}:${String(lineNumber)}:${String(columnNumber)}`
  return `${message || "Unknown Worker error"}${location}`
}

export default function createWebWorkerUciTransport(
  worker: StockfishWebWorker,
): StockfishUciTransport {
  const lines = new WorkerLineQueue()
  let diagnosticText = ""
  let terminated = false
  let failed = false
  let resolveExit: ((result: StockfishUciTransportExit) => void) | undefined
  let rejectExit: ((reason?: unknown) => void) | undefined
  const exit = new Promise<StockfishUciTransportExit>((resolve, reject) => {
    resolveExit = resolve
    rejectExit = reject
  })
  void exit.catch(() => undefined)

  const fail = (error: StockfishProtocolError): void => {
    if (failed || terminated) return

    failed = true
    diagnosticText = error.message.slice(-MAX_DIAGNOSTIC_CHARACTERS)
    lines.fail(error)
    rejectExit?.(error)
    resolveExit = undefined
    rejectExit = undefined
  }

  const onMessage = (event: Event): void => {
    const data = "data" in event ? event.data : undefined
    if (typeof data !== "string") {
      fail(
        new StockfishProtocolError(
          `Stockfish Worker emitted a non-string ${typeof data} message.`,
        ),
      )
      return
    }

    for (const line of data.split(/\r?\n/)) {
      if (line.length > 0) lines.push(line)
    }
  }

  const onError = (event: Event): void => {
    event.preventDefault()
    fail(
      new StockfishProtocolError(
        `Stockfish Worker failed: ${workerErrorMessage(event)}.`,
      ),
    )
  }

  const onMessageError = (): void => {
    fail(
      new StockfishProtocolError(
        "Stockfish Worker message deserialization failed.",
      ),
    )
  }

  worker.addEventListener("message", onMessage)
  worker.addEventListener("error", onError)
  worker.addEventListener("messageerror", onMessageError)

  const terminate = async (): Promise<void> => {
    if (terminated) return

    terminated = true
    worker.removeEventListener("message", onMessage)
    worker.removeEventListener("error", onError)
    worker.removeEventListener("messageerror", onMessageError)
    worker.terminate()
    lines.close()
    resolveExit?.({ code: null, signal: "worker-terminated" })
    resolveExit = undefined
    rejectExit = undefined
  }

  return {
    lines,
    diagnosticText: () => diagnosticText,
    terminate,
    waitForExit: () => exit,
    writeLine: async (line) => {
      if (terminated || failed) {
        throw new StockfishProtocolError(
          "Stockfish Worker transport is not running.",
        )
      }

      try {
        worker.postMessage(line)
      } catch (error) {
        const protocolError = new StockfishProtocolError(
          `Stockfish Worker command failed: ${error instanceof Error ? error.message : String(error)}.`,
        )
        fail(protocolError)
        throw protocolError
      }

      if (line === "quit") await terminate()
    },
  }
}

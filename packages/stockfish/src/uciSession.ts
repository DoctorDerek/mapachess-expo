import {
  assertNotAborted,
  createConfigurationCommands,
  parseBestMove,
  parseInformation,
  parseUciOption,
  validateHandshake,
  validateSearchRequest,
  type UciHandshake,
  type UciOption,
} from "./uciProtocol.js"
import {
  StockfishOperationAbortedError,
  StockfishProtocolError,
  type StockfishSearchInformation,
  type StockfishUciIdentity,
  type StockfishUciSession,
  type StockfishUciSessionInput,
  type StockfishUciSessionState,
} from "./uciTypes.js"

export { StockfishOperationAbortedError, StockfishProtocolError }
export type {
  StockfishPosition,
  StockfishScore,
  StockfishSearchInformation,
  StockfishSearchRequest,
  StockfishSearchResult,
  StockfishStrength,
  StockfishUciConfiguration,
  StockfishUciExpectation,
  StockfishUciIdentity,
  StockfishUciSession,
  StockfishUciSessionInput,
  StockfishUciSessionState,
  StockfishUciTransport,
  StockfishUciTransportExit,
} from "./uciTypes.js"

export default function createStockfishUciSession(
  input: StockfishUciSessionInput,
): StockfishUciSession {
  let sessionState: StockfishUciSessionState = "created"
  let lineIterator: AsyncIterator<string> | undefined
  let activeRequestId: string | undefined

  const terminateTransport = async (): Promise<void> => {
    await input.transport.terminate()
  }

  const fail = async (): Promise<void> => {
    if (sessionState !== "closed") sessionState = "failed"
    await terminateTransport()
  }

  const readLine = async (
    operation: string,
    signal?: AbortSignal,
  ): Promise<string> => {
    if (lineIterator === undefined) {
      throw new StockfishProtocolError("Stockfish transport is not running.")
    }

    assertNotAborted(signal, operation)

    let rejectAbort:
      ((error: StockfishOperationAbortedError) => void) | undefined
    const abort = new Promise<never>((_resolve, reject) => {
      rejectAbort = reject
    })
    const onAbort = (): void => {
      rejectAbort?.(new StockfishOperationAbortedError(operation))
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    try {
      const nextLine = lineIterator.next()
      const exited = input.transport.waitForExit().then((result): never => {
        const diagnostic = input.transport.diagnosticText().trim()
        throw new StockfishProtocolError(
          `Stockfish exited before ${operation} completed (code ${String(result.code)}, signal ${String(result.signal)})${diagnostic ? `: ${diagnostic}` : "."}`,
        )
      })
      const result = await Promise.race([nextLine, exited, abort])

      if (result.done) {
        throw new StockfishProtocolError(
          `Stockfish closed stdout before ${operation} completed.`,
        )
      }

      return result.value
    } finally {
      signal?.removeEventListener("abort", onAbort)
    }
  }

  const writeLine = async (line: string): Promise<void> => {
    await input.transport.writeLine(line)
  }

  const synchronize = async (
    operation: string,
    signal?: AbortSignal,
  ): Promise<void> => {
    await writeLine("isready")

    while ((await readLine(operation, signal)) !== "readyok") {
      continue
    }
  }

  const readHandshake = async (signal?: AbortSignal): Promise<UciHandshake> => {
    let name = ""
    let author = ""
    const options = new Map<string, UciOption>()

    while (true) {
      const line = await readLine("UCI handshake", signal)
      if (line === "uciok") return { name, author, options }
      if (line.startsWith("id name ")) name = line.slice("id name ".length)
      if (line.startsWith("id author ")) {
        author = line.slice("id author ".length)
      }

      const option = parseUciOption(line)
      if (option !== undefined) options.set(option.name, option)
    }
  }

  const boot = async (signal?: AbortSignal): Promise<StockfishUciIdentity> => {
    if (sessionState !== "created") {
      throw new StockfishProtocolError(
        `Stockfish cannot boot from state ${sessionState}.`,
      )
    }

    sessionState = "booting"

    try {
      assertNotAborted(signal, "boot")
      lineIterator = input.transport.lines[Symbol.asyncIterator]()
      await writeLine("uci")
      const handshake = await readHandshake(signal)
      validateHandshake(handshake, input.expectedIdentity, input.configuration)

      for (const command of createConfigurationCommands(input.configuration)) {
        await writeLine(command)
      }

      await synchronize("configuration readiness", signal)
      await writeLine("ucinewgame")
      await synchronize("new-game readiness", signal)
      sessionState = "ready"

      return {
        name: handshake.name,
        author: handshake.author,
        optionNames: [...handshake.options.keys()].sort(),
      }
    } catch (error) {
      await fail()
      throw error
    }
  }

  const search: StockfishUciSession["search"] = async (request, signal) => {
    validateSearchRequest(request)

    if (sessionState !== "ready") {
      throw new StockfishProtocolError(
        `Stockfish cannot search from state ${sessionState}.`,
      )
    }

    assertNotAborted(signal, `search request ${request.requestId}`)
    sessionState = "searching"
    activeRequestId = request.requestId

    try {
      const moves =
        request.position.moves.length === 0
          ? ""
          : ` moves ${request.position.moves.join(" ")}`
      await writeLine(`position fen ${request.position.fen}${moves}`)
      await writeLine(`go nodes ${request.nodeLimit}`)

      let informationLineCount = 0
      let latestInformation: StockfishSearchInformation | undefined

      while (true) {
        const line = await readLine(
          `search request ${request.requestId}`,
          signal,
        )

        if (line.startsWith("info ")) {
          informationLineCount += 1
          latestInformation = parseInformation(line)
          continue
        }

        if (line.startsWith("bestmove ")) {
          if (activeRequestId !== request.requestId) {
            throw new StockfishProtocolError(
              `Rejected stale Stockfish result for request ${request.requestId}.`,
            )
          }

          const result = parseBestMove(line)
          activeRequestId = undefined
          sessionState = "ready"

          return {
            requestId: request.requestId,
            bestMove: result.bestMove,
            informationLineCount,
            ...(result.ponderMove === undefined
              ? {}
              : { ponderMove: result.ponderMove }),
            ...(latestInformation === undefined ? {} : { latestInformation }),
          }
        }
      }
    } catch (error) {
      activeRequestId = undefined
      await fail()
      throw error
    }
  }

  const close = async (): Promise<void> => {
    if (sessionState === "closed") return

    if (sessionState === "ready") {
      sessionState = "closing"
      await writeLine("quit")
      await input.transport.waitForExit()
    } else {
      await terminateTransport()
    }

    sessionState = "closed"
  }

  return { boot, close, search, state: () => sessionState }
}

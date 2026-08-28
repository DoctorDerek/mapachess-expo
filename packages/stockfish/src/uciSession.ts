import {
  StockfishOperationAbortedError,
  type StockfishEngineSessionState,
} from "./engineSession.js"
import {
  assertStockfishOperationNotAborted,
  validateStockfishSearchRequest,
} from "./engineValidation.js"
import {
  createConfigurationCommands,
  parseBestMove,
  parseInformation,
  parseUciOption,
  validateHandshake,
  type UciHandshake,
  type UciOption,
} from "./uciProtocol.js"
import {
  StockfishProtocolError,
  type StockfishUciIdentity,
  type StockfishUciSearchInformation,
  type StockfishUciSession,
  type StockfishUciSessionInput,
} from "./uciTypes.js"

export { StockfishProtocolError }
export type {
  StockfishUciExpectation,
  StockfishUciIdentity,
  StockfishUciSearchInformation,
  StockfishUciSearchResult,
  StockfishUciSession,
  StockfishUciSessionInput,
  StockfishUciTransport,
  StockfishUciTransportExit,
} from "./uciTypes.js"

export default function createStockfishUciSession(
  input: StockfishUciSessionInput,
): StockfishUciSession {
  let sessionState: StockfishEngineSessionState = "created"
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

    assertStockfishOperationNotAborted(signal, operation)

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
      assertStockfishOperationNotAborted(signal, "boot")
      lineIterator = input.transport.lines[Symbol.asyncIterator]()
      await writeLine("uci")
      const handshake = await readHandshake(signal)
      validateHandshake(handshake, input.expectedIdentity, input.configuration)

      for (const command of createConfigurationCommands(
        input.configuration,
        handshake.options,
      )) {
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
    validateStockfishSearchRequest(request)

    if (sessionState !== "ready") {
      throw new StockfishProtocolError(
        `Stockfish cannot search from state ${sessionState}.`,
      )
    }

    assertStockfishOperationNotAborted(
      signal,
      `search request ${request.requestId}`,
    )
    sessionState = "searching"
    activeRequestId = request.requestId
    const operation = `search request ${request.requestId}`
    let cancellationRequested = false
    let cancellationCompleted = false
    let stopWrite: Promise<void> | undefined
    let rejectStopWriteFailure: ((reason?: unknown) => void) | undefined
    const stopWriteFailure = new Promise<never>((_resolve, reject) => {
      rejectStopWriteFailure = reject
    })
    void stopWriteFailure.catch(() => undefined)

    const requestCancellation = (): void => {
      if (cancellationRequested) return

      cancellationRequested = true
      activeRequestId = undefined
      sessionState = "stopping"
      stopWrite = writeLine("stop")
      void stopWrite.catch((error: unknown) => {
        rejectStopWriteFailure?.(error)
      })
    }

    const onAbort = (): void => {
      requestCancellation()
    }

    try {
      const moves =
        request.position.moves.length === 0
          ? ""
          : ` moves ${request.position.moves.join(" ")}`
      await writeLine(`position fen ${request.position.fen}${moves}`)
      await writeLine(`go nodes ${request.nodeLimit}`)
      signal?.addEventListener("abort", onAbort, { once: true })
      if (signal?.aborted === true) requestCancellation()

      let informationLineCount = 0
      let latestInformation: StockfishUciSearchInformation | undefined

      while (true) {
        const line = await Promise.race([readLine(operation), stopWriteFailure])

        if (line.startsWith("info ")) {
          if (!cancellationRequested) {
            informationLineCount += 1
            latestInformation = parseInformation(line)
          }
          continue
        }

        if (line.startsWith("bestmove ")) {
          if (cancellationRequested) {
            await stopWrite
            sessionState = "ready"
            cancellationCompleted = true
            throw new StockfishOperationAbortedError(operation)
          }

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
      if (cancellationCompleted) throw error
      await fail()
      throw error
    } finally {
      signal?.removeEventListener("abort", onAbort)
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

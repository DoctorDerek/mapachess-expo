import {
  validateStockfishBuildIdentity,
  type StockfishBuildIdentity,
} from "./buildIdentity.js"
import createNodeUciTransport from "./nodeUciTransport.js"
import { sha256File, type ProvisionedStockfish } from "./provision.js"
import {
  assertNotAborted,
  assertStableText,
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
  STOCKFISH_PROCESS_ADAPTER_VERSION,
  StockfishOperationAbortedError,
  StockfishProtocolError,
  type StockfishProcessAdapter,
  type StockfishProcessAdapterInput,
  type StockfishProcessState,
  type StockfishSearchInformation,
  type StockfishUciConfiguration,
  type StockfishUciIdentity,
  type StockfishUciTransport,
} from "./uciTypes.js"

export {
  createNodeUciTransport,
  StockfishOperationAbortedError,
  StockfishProtocolError,
  STOCKFISH_PROCESS_ADAPTER_VERSION,
}
export type {
  StockfishPosition,
  StockfishProcessAdapter,
  StockfishProcessAdapterInput,
  StockfishProcessExit,
  StockfishProcessState,
  StockfishScore,
  StockfishSearchInformation,
  StockfishSearchRequest,
  StockfishSearchResult,
  StockfishStrength,
  StockfishUciConfiguration,
  StockfishUciIdentity,
  StockfishUciTransport,
  StockfishUciTransportFactory,
} from "./uciTypes.js"

export default function createStockfishProcessAdapter(
  input: StockfishProcessAdapterInput,
): StockfishProcessAdapter {
  validateStockfishBuildIdentity(input.expectedIdentity)
  assertStableText(input.executablePath, "executablePath")

  let processState: StockfishProcessState = "created"
  let transport: StockfishUciTransport | undefined
  let lineIterator: AsyncIterator<string> | undefined
  let activeRequestId: string | undefined

  const terminateTransport = async (): Promise<void> => {
    if (transport !== undefined) await transport.terminate()
  }

  const fail = async (): Promise<void> => {
    if (processState !== "closed") processState = "failed"
    await terminateTransport()
  }

  const readLine = async (
    operation: string,
    signal?: AbortSignal,
  ): Promise<string> => {
    if (lineIterator === undefined || transport === undefined) {
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
      const exited = transport.waitForExit().then((result): never => {
        const diagnostic = transport?.diagnosticText().trim()
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
    if (transport === undefined) {
      throw new StockfishProtocolError("Stockfish transport is not running.")
    }

    await transport.writeLine(line)
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
    if (processState !== "created") {
      throw new StockfishProtocolError(
        `Stockfish cannot boot from state ${processState}.`,
      )
    }

    processState = "booting"

    try {
      assertNotAborted(signal, "boot")
      const actualExecutableSha256 = await sha256File(input.executablePath)
      assertNotAborted(signal, "boot")
      if (actualExecutableSha256 !== input.expectedIdentity.executableSha256) {
        throw new StockfishProtocolError(
          `Stockfish executable SHA-256 mismatch: expected ${input.expectedIdentity.executableSha256}, received ${actualExecutableSha256}.`,
        )
      }

      transport = (input.transportFactory ?? createNodeUciTransport)(
        input.executablePath,
      )
      lineIterator = transport.lines[Symbol.asyncIterator]()
      await writeLine("uci")
      const handshake = await readHandshake(signal)
      validateHandshake(handshake, input.expectedIdentity, input.configuration)

      for (const command of createConfigurationCommands(input.configuration)) {
        await writeLine(command)
      }

      await synchronize("configuration readiness", signal)
      await writeLine("ucinewgame")
      await synchronize("new-game readiness", signal)
      processState = "ready"

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

  const search: StockfishProcessAdapter["search"] = async (request, signal) => {
    validateSearchRequest(request)

    if (processState !== "ready") {
      throw new StockfishProtocolError(
        `Stockfish cannot search from state ${processState}.`,
      )
    }

    assertNotAborted(signal, `search request ${request.requestId}`)
    processState = "searching"
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
          processState = "ready"

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
    if (processState === "closed") return
    if (transport === undefined) {
      processState = "closed"
      return
    }

    if (processState === "ready") {
      processState = "closing"
      await writeLine("quit")
      await transport.waitForExit()
    } else {
      await terminateTransport()
    }

    processState = "closed"
  }

  return { boot, close, search, state: () => processState }
}

export function createProvisionedStockfishProcessAdapter(
  provisioned: ProvisionedStockfish,
  configuration: StockfishUciConfiguration,
): StockfishProcessAdapter {
  return createStockfishProcessAdapter({
    configuration,
    executablePath: provisioned.executablePath,
    expectedIdentity: provisioned.identity,
  })
}

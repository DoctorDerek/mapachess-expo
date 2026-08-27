import {
  validateStockfishBuildIdentity,
  type StockfishBuildIdentity,
} from "./buildIdentity.js"
import {
  type StockfishEngineConfiguration,
  type StockfishEngineSessionState,
} from "./engineSession.js"
import createNodeUciTransport from "./nodeUciTransport.js"
import { sha256File, type ProvisionedStockfish } from "./provision.js"
import {
  assertNotAborted,
  assertStableText,
  validateSearchRequest,
} from "./uciProtocol.js"
import createStockfishUciSession, {
  StockfishProtocolError,
} from "./uciSession.js"
import {
  type StockfishUciExpectation,
  type StockfishUciSession,
  type StockfishUciTransport,
} from "./uciTypes.js"

export const STOCKFISH_PROCESS_ADAPTER_VERSION =
  "stockfish-process-adapter/v1" as const

export { createNodeUciTransport, StockfishProtocolError }

export type StockfishProcessAdapter = StockfishUciSession

export type StockfishProcessAdapterInput = Readonly<{
  configuration: StockfishEngineConfiguration
  executablePath: string
  expectedIdentity: StockfishBuildIdentity
  transport?: StockfishUciTransport
}>

function expectedUciIdentity(
  buildIdentity: StockfishBuildIdentity,
): StockfishUciExpectation {
  return {
    name: `Stockfish ${buildIdentity.version}`,
    networkDefaults: {
      big: buildIdentity.networks.big.fileName,
      small: buildIdentity.networks.small.fileName,
    },
    requiresSyzygyPath: true,
  }
}

export default function createStockfishProcessAdapter(
  input: StockfishProcessAdapterInput,
): StockfishProcessAdapter {
  validateStockfishBuildIdentity(input.expectedIdentity)
  assertStableText(input.executablePath, "executablePath")

  let processState: StockfishEngineSessionState = "created"
  let session: StockfishProcessAdapter | undefined
  const state = (): StockfishEngineSessionState =>
    session?.state() ?? processState

  const boot: StockfishProcessAdapter["boot"] = async (signal) => {
    const currentState = state()
    if (currentState !== "created") {
      throw new StockfishProtocolError(
        `Stockfish cannot boot from state ${currentState}.`,
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

      session = createStockfishUciSession({
        configuration: input.configuration,
        expectedIdentity: expectedUciIdentity(input.expectedIdentity),
        transport:
          input.transport ?? createNodeUciTransport(input.executablePath),
      })

      return await session.boot(signal)
    } catch (error) {
      if (session === undefined) processState = "failed"
      throw error
    }
  }

  const search: StockfishProcessAdapter["search"] = async (request, signal) => {
    if (session === undefined) {
      validateSearchRequest(request)
      throw new StockfishProtocolError(
        `Stockfish cannot search from state ${processState}.`,
      )
    }

    return session.search(request, signal)
  }

  const close = async (): Promise<void> => {
    if (session !== undefined) {
      await session.close()
      return
    }

    processState = "closed"
  }

  return {
    boot,
    close,
    search,
    state,
  }
}

export function createProvisionedStockfishProcessAdapter(
  provisioned: ProvisionedStockfish,
  configuration: StockfishEngineConfiguration,
): StockfishProcessAdapter {
  return createStockfishProcessAdapter({
    configuration,
    executablePath: provisioned.executablePath,
    expectedIdentity: provisioned.identity,
  })
}

import type {
  StockfishEngineConfiguration,
  StockfishEngineIdentity,
  StockfishEngineSearchInformation,
  StockfishEngineSearchResult,
  StockfishEngineSession,
  StockfishEngineSessionState,
  StockfishPosition,
  StockfishScore,
  StockfishSearchRequest,
  StockfishStrength,
} from "./engineSession.js"
import { StockfishOperationAbortedError } from "./engineSession.js"

export const STOCKFISH_PROCESS_ADAPTER_VERSION =
  "stockfish-process-adapter/v1" as const

export type StockfishUciSearchInformation = StockfishEngineSearchInformation &
  Readonly<{
    line: string
  }>

export type StockfishUciSearchResult = StockfishEngineSearchResult &
  Readonly<{
    informationLineCount: number
    latestInformation?: StockfishUciSearchInformation
  }>

export type StockfishUciIdentity = StockfishEngineIdentity &
  Readonly<{
    optionNames: readonly string[]
  }>

export type StockfishUciExpectation = Readonly<{
  name: string
  networkDefaults: Readonly<{
    big: string
    small: string
  }>
  requiresSyzygyPath: boolean
}>

export type StockfishUciTransportExit = Readonly<{
  code: number | null
  signal: string | null
}>

export type StockfishUciTransport = Readonly<{
  lines: AsyncIterable<string>
  diagnosticText: () => string
  terminate: () => Promise<void>
  waitForExit: () => Promise<StockfishUciTransportExit>
  writeLine: (line: string) => Promise<void>
}>

export type StockfishUciSessionInput = Readonly<{
  configuration: StockfishEngineConfiguration
  expectedIdentity: StockfishUciExpectation
  transport: StockfishUciTransport
}>

export type StockfishUciSession = StockfishEngineSession<
  StockfishUciIdentity,
  StockfishUciSearchResult
>

export type StockfishUciSessionState = StockfishEngineSessionState
export type StockfishUciConfiguration = StockfishEngineConfiguration
export type StockfishSearchInformation = StockfishUciSearchInformation
export type StockfishSearchResult = StockfishUciSearchResult
export type StockfishProcessAdapter = StockfishUciSession
export type StockfishProcessExit = StockfishUciTransportExit
export type StockfishProcessState = StockfishEngineSessionState

export type {
  StockfishPosition,
  StockfishScore,
  StockfishSearchRequest,
  StockfishStrength,
}
export { StockfishOperationAbortedError }

export class StockfishProtocolError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "StockfishProtocolError"
  }
}

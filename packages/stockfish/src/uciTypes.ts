import type {
  StockfishEngineConfiguration,
  StockfishEngineIdentity,
  StockfishEngineSearchInformation,
  StockfishEngineSearchResult,
  StockfishEngineSession,
} from "./engineSession.js"

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

export class StockfishProtocolError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "StockfishProtocolError"
  }
}

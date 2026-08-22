import type { StockfishBuildIdentity } from "./buildIdentity.js"

export const STOCKFISH_PROCESS_ADAPTER_VERSION =
  "stockfish-process-adapter/v1" as const

export type StockfishProcessState =
  | "created"
  | "booting"
  | "ready"
  | "searching"
  | "closing"
  | "closed"
  | "failed"

export type StockfishStrength =
  | Readonly<{ kind: "full-strength" }>
  | Readonly<{ elo: number; kind: "uci-elo" }>

export type StockfishUciConfiguration = Readonly<{
  hashMegabytes: number
  multiPv: number
  ponder: boolean
  strength: StockfishStrength
  threads: number
  variant: "chess960" | "standard"
}>

export type StockfishPosition = Readonly<{
  fen: string
  moves: readonly string[]
}>

export type StockfishSearchRequest = Readonly<{
  nodeLimit: number
  position: StockfishPosition
  requestId: string
}>

export type StockfishScore = Readonly<{
  bound: "exact" | "lower" | "upper"
  kind: "centipawns" | "mate"
  value: number
}>

export type StockfishSearchInformation = Readonly<{
  depth?: number
  line: string
  nodes?: number
  score?: StockfishScore
  selectiveDepth?: number
}>

export type StockfishSearchResult = Readonly<{
  bestMove: string | null
  informationLineCount: number
  latestInformation?: StockfishSearchInformation
  ponderMove?: string
  requestId: string
}>

export type StockfishUciIdentity = Readonly<{
  author: string
  name: string
  optionNames: readonly string[]
}>

export type StockfishProcessExit = Readonly<{
  code: number | null
  signal: NodeJS.Signals | null
}>

export type StockfishUciTransport = Readonly<{
  lines: AsyncIterable<string>
  diagnosticText: () => string
  terminate: () => Promise<void>
  waitForExit: () => Promise<StockfishProcessExit>
  writeLine: (line: string) => Promise<void>
}>

export type StockfishUciTransportFactory = (
  executablePath: string,
) => StockfishUciTransport

export type StockfishProcessAdapterInput = Readonly<{
  configuration: StockfishUciConfiguration
  executablePath: string
  expectedIdentity: StockfishBuildIdentity
  transportFactory?: StockfishUciTransportFactory
}>

export type StockfishProcessAdapter = Readonly<{
  boot: (signal?: AbortSignal) => Promise<StockfishUciIdentity>
  close: () => Promise<void>
  search: (
    request: StockfishSearchRequest,
    signal?: AbortSignal,
  ) => Promise<StockfishSearchResult>
  state: () => StockfishProcessState
}>

export class StockfishOperationAbortedError extends Error {
  public constructor(operation: string) {
    super(`Stockfish ${operation} was aborted.`)
    this.name = "StockfishOperationAbortedError"
  }
}

export class StockfishProtocolError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "StockfishProtocolError"
  }
}

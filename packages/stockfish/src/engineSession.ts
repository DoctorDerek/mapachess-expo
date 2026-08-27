export type StockfishEngineSessionState =
  | "created"
  | "booting"
  | "ready"
  | "searching"
  | "stopping"
  | "closing"
  | "closed"
  | "failed"

export type StockfishStrength =
  | Readonly<{ kind: "full-strength" }>
  | Readonly<{ elo: number; kind: "uci-elo" }>

export type StockfishEngineConfiguration = Readonly<{
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

export type StockfishEngineSearchInformation = Readonly<{
  depth?: number
  nodes?: number
  score?: StockfishScore
  selectiveDepth?: number
}>

export type StockfishEngineSearchResult = Readonly<{
  bestMove: string | null
  latestInformation?: StockfishEngineSearchInformation
  ponderMove?: string
  requestId: string
}>

export type StockfishEngineIdentity = Readonly<{
  author: string
  name: string
}>

export type StockfishEngineSession<
  Identity extends StockfishEngineIdentity = StockfishEngineIdentity,
  SearchResult extends StockfishEngineSearchResult =
    StockfishEngineSearchResult,
> = Readonly<{
  boot: (signal?: AbortSignal) => Promise<Identity>
  close: () => Promise<void>
  search: (
    request: StockfishSearchRequest,
    signal?: AbortSignal,
  ) => Promise<SearchResult>
  state: () => StockfishEngineSessionState
}>

export class StockfishOperationAbortedError extends Error {
  public constructor(operation: string) {
    super(`Stockfish ${operation} was aborted.`)
    this.name = "StockfishOperationAbortedError"
  }
}

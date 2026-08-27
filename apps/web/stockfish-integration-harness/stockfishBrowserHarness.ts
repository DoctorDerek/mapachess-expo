import {
  StockfishOperationAbortedError,
  type StockfishSearchResult,
  type StockfishUciConfiguration,
  type StockfishUciIdentity,
  type StockfishUciSession,
  type StockfishUciSessionState,
} from "@mapachess/stockfish/uci-session"
import createWebStockfishSession from "../lib/stockfish/createWebStockfishSession"

const STANDARD_FEN = "8/8/8/8/8/4k3/8/4K3 w - - 0 1"
const CHESS960_FEN = "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1"
const SEARCH_NODE_LIMIT = 1_000
const CANCELLATION_NODE_LIMIT = 1_000_000_000

const COMMON_CONFIGURATION = {
  strength: { kind: "full-strength" },
  threads: 1,
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
} as const

type CancellationProof = Readonly<{
  errorMessage: string
  errorName: string
}>

type TimingsMilliseconds = Readonly<{
  cancellationDrain: number
  chess960Boot: number
  chess960Search: number
  standardBoot: number
  standardSearch: number
  subsequentStandardSearch: number
}>

export type StockfishBrowserProof = Readonly<{
  chess960: Readonly<{
    finalState: StockfishUciSessionState
    identity: StockfishUciIdentity
    search: StockfishSearchResult
  }>
  standard: Readonly<{
    cancellation: CancellationProof
    finalState: StockfishUciSessionState
    identity: StockfishUciIdentity
    initialSearch: StockfishSearchResult
    subsequentSearch: StockfishSearchResult
  }>
  timingsMilliseconds: TimingsMilliseconds
}>

type MeasuredResult<Value> = Readonly<{
  elapsedMilliseconds: number
  value: Value
}>

type ClosedSessionResult<Value> = Readonly<{
  finalState: StockfishUciSessionState
  value: Value
}>

export type StockfishBrowserHarness = Readonly<{
  runProof(): Promise<StockfishBrowserProof>
}>

declare global {
  interface Window {
    mapachessStockfishBrowserHarness: StockfishBrowserHarness
  }
}

async function measure<Value>(
  operation: () => Promise<Value>,
): Promise<MeasuredResult<Value>> {
  const startedAt = performance.now()
  const value = await operation()
  return { elapsedMilliseconds: performance.now() - startedAt, value }
}

async function useClosedSession<Value>(
  configuration: StockfishUciConfiguration,
  operation: (session: StockfishUciSession) => Promise<Value>,
): Promise<ClosedSessionResult<Value>> {
  const session = createWebStockfishSession(configuration)
  const value = await (async () => {
    try {
      return await operation(session)
    } finally {
      await session.close()
    }
  })()

  return { finalState: session.state(), value }
}

async function proveCancellation(
  session: StockfishUciSession,
): Promise<CancellationProof> {
  const controller = new AbortController()
  const search = session.search(
    {
      requestId: "standard-cancelled-search",
      nodeLimit: CANCELLATION_NODE_LIMIT,
      position: { fen: STANDARD_FEN, moves: [] },
    },
    controller.signal,
  )

  queueMicrotask(() => controller.abort())

  try {
    await search
  } catch (error) {
    if (error instanceof StockfishOperationAbortedError) {
      return { errorMessage: error.message, errorName: error.name }
    }
    throw error
  }

  throw new Error("The cancelled Stockfish search unexpectedly resolved.")
}

async function runProof(): Promise<StockfishBrowserProof> {
  const standard = await useClosedSession(
    {
      ...COMMON_CONFIGURATION,
      variant: "standard",
    },
    async (session) => {
      const boot = await measure(() => session.boot())
      const initialSearch = await measure(() =>
        session.search({
          requestId: "standard-initial-search",
          nodeLimit: SEARCH_NODE_LIMIT,
          position: { fen: STANDARD_FEN, moves: [] },
        }),
      )
      const cancellation = await measure(() => proveCancellation(session))
      const subsequentSearch = await measure(() =>
        session.search({
          requestId: "standard-subsequent-search",
          nodeLimit: SEARCH_NODE_LIMIT,
          position: { fen: STANDARD_FEN, moves: [] },
        }),
      )

      return { boot, cancellation, initialSearch, subsequentSearch }
    },
  )

  const chess960 = await useClosedSession(
    {
      ...COMMON_CONFIGURATION,
      variant: "chess960",
    },
    async (session) => {
      const boot = await measure(() => session.boot())
      const search = await measure(() =>
        session.search({
          requestId: "chess960-search",
          nodeLimit: SEARCH_NODE_LIMIT,
          position: { fen: CHESS960_FEN, moves: [] },
        }),
      )

      return { boot, search }
    },
  )

  return {
    standard: {
      cancellation: standard.value.cancellation.value,
      finalState: standard.finalState,
      identity: standard.value.boot.value,
      initialSearch: standard.value.initialSearch.value,
      subsequentSearch: standard.value.subsequentSearch.value,
    },
    chess960: {
      finalState: chess960.finalState,
      identity: chess960.value.boot.value,
      search: chess960.value.search.value,
    },
    timingsMilliseconds: {
      cancellationDrain: standard.value.cancellation.elapsedMilliseconds,
      chess960Boot: chess960.value.boot.elapsedMilliseconds,
      chess960Search: chess960.value.search.elapsedMilliseconds,
      standardBoot: standard.value.boot.elapsedMilliseconds,
      standardSearch: standard.value.initialSearch.elapsedMilliseconds,
      subsequentStandardSearch:
        standard.value.subsequentSearch.elapsedMilliseconds,
    },
  }
}

window.mapachessStockfishBrowserHarness = { runProof }

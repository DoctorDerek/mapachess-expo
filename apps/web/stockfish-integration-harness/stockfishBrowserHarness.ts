import createBetterHintsAnalyst, {
  BETTER_HINTS_ENGINE_MULTIPV,
} from "@mapachess/hints/better-hints"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchPosition,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import {
  StockfishOperationAbortedError,
  type StockfishEngineConfiguration,
  type StockfishEngineSessionState,
} from "@mapachess/stockfish/engine-session"
import type {
  StockfishUciIdentity,
  StockfishUciSearchResult,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import createWebStockfishSession from "../lib/stockfish/createWebStockfishSession"

const STANDARD_FEN = "8/8/8/8/8/4k3/8/4K3 w - - 0 1"
const CHESS960_FEN = "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1"
const CHECKED_HINT_FEN = "4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1"
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
    finalState: StockfishEngineSessionState
    identity: StockfishUciIdentity
    search: StockfishUciSearchResult
  }>
  standard: Readonly<{
    cancellation: CancellationProof
    finalState: StockfishEngineSessionState
    identity: StockfishUciIdentity
    initialSearch: StockfishUciSearchResult
    subsequentSearch: StockfishUciSearchResult
  }>
  timingsMilliseconds: TimingsMilliseconds
}>

type MeasuredResult<Value> = Readonly<{
  elapsedMilliseconds: number
  value: Value
}>

type ClosedSessionResult<Value> = Readonly<{
  finalState: StockfishEngineSessionState
  value: Value
}>

export type BetterHintsBrowserProof = Readonly<{
  checked: BetterHintsResult
  checkedPositionFen: string
  finalState: StockfishEngineSessionState
  identity: StockfishUciIdentity
  initial: BetterHintsResult
  timingsMilliseconds: Readonly<{
    boot: number
    checked: number
    initial: number
  }>
}>

export type StockfishBrowserHarness = Readonly<{
  runBetterHintsProof(): Promise<BetterHintsBrowserProof>
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
  configuration: StockfishEngineConfiguration,
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

const STANDARD_STARTING_POSITION: MatchStartingPosition = Object.freeze({
  chess960PositionId: null,
  variant: "standard",
})

const requireStandardPosition = (fen: string): MatchPosition => {
  const result = reconstructMatchPosition(STANDARD_STARTING_POSITION, fen)
  if (!result.ok) {
    throw new Error("Better Hints browser proof contains an invalid position.")
  }
  return result.position
}

async function runBetterHintsProof(): Promise<BetterHintsBrowserProof> {
  const proof = await useClosedSession(
    {
      ...COMMON_CONFIGURATION,
      multiPv: BETTER_HINTS_ENGINE_MULTIPV,
      variant: "standard",
    },
    async (session) => {
      const boot = await measure(() => session.boot())
      const analyst = createBetterHintsAnalyst({ engine: session })
      const initialPosition = createInitialMatchPosition(
        STANDARD_STARTING_POSITION,
      )
      const initial = await measure(() =>
        analyst.analyze({
          playerColor: "white",
          position: initialPosition,
          requestId: "browser-proof/initial",
        }),
      )
      const checkedPosition = requireStandardPosition(CHECKED_HINT_FEN)
      const checked = await measure(() =>
        analyst.analyze({
          playerColor: "white",
          position: checkedPosition,
          requestId: "browser-proof/checked",
        }),
      )

      return { boot, checked, checkedPosition, initial }
    },
  )

  return {
    checked: proof.value.checked.value,
    checkedPositionFen: proof.value.checkedPosition.fen,
    finalState: proof.finalState,
    identity: proof.value.boot.value,
    initial: proof.value.initial.value,
    timingsMilliseconds: {
      boot: proof.value.boot.elapsedMilliseconds,
      checked: proof.value.checked.elapsedMilliseconds,
      initial: proof.value.initial.elapsedMilliseconds,
    },
  }
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

window.mapachessStockfishBrowserHarness = { runBetterHintsProof, runProof }

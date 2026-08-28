import type {
  StockfishEngineConfiguration,
  StockfishEngineSearchInformation,
  StockfishScore,
} from "@mapachess/stockfish/engine-session"
import { assertStockfishUciMove } from "@mapachess/stockfish/engine-validation"
import type {
  NativeStockfishBestMoveEvent,
  NativeStockfishConfiguration,
  NativeStockfishFailureEvent,
  NativeStockfishReadyEvent,
  NativeStockfishSearchInformationEvent,
  NativeStockfishSearchRequest,
} from "./NativeMapachessStockfish.js"

type NativeEventSubscription = Readonly<{ remove: () => void }>
type NativeEvent<T> = (
  listener: (event: T) => void | Promise<void>,
) => NativeEventSubscription

export type NativeStockfishModuleBoundary = Readonly<{
  boot: (configuration: NativeStockfishConfiguration) => void
  close: () => void
  onBestMove: NativeEvent<NativeStockfishBestMoveEvent>
  onClosed: NativeEvent<void>
  onFailure: NativeEvent<NativeStockfishFailureEvent>
  onReady: NativeEvent<NativeStockfishReadyEvent>
  onSearchInformation: NativeEvent<NativeStockfishSearchInformationEvent>
  startSearch: (request: NativeStockfishSearchRequest) => void
  stop: (requestId: string) => void
}>

export class StockfishNativeSessionError extends Error {
  public readonly code: string
  public readonly requestId: string

  public constructor(code: string, message: string, requestId = "") {
    super(message)
    this.name = "StockfishNativeSessionError"
    this.code = code
    this.requestId = requestId
  }
}

export function configurationForNative(
  configuration: StockfishEngineConfiguration,
): NativeStockfishConfiguration {
  const limitedStrength = configuration.strength.kind === "uci-elo"

  return {
    elo: limitedStrength ? configuration.strength.elo : 0,
    hashMegabytes: configuration.hashMegabytes,
    isChess960: configuration.variant === "chess960",
    limitStrength: limitedStrength,
    multiPv: configuration.multiPv,
    ponder: configuration.ponder,
    threads: configuration.threads,
  }
}

function boundFromNative(value: string): StockfishScore["bound"] {
  if (value === "") return "exact"
  if (value === "lowerbound") return "lower"
  if (value === "upperbound") return "upper"
  throw new StockfishNativeSessionError(
    "invalid-search-information",
    `The native engine emitted an unknown score bound: ${value}.`,
  )
}

function scoreFromNative(
  event: NativeStockfishSearchInformationEvent,
): StockfishScore {
  if (event.scoreKind === "centipawns") {
    return {
      bound: boundFromNative(event.bound),
      kind: "centipawns",
      value: event.centipawns,
    }
  }

  if (event.scoreKind === "mate") {
    return {
      bound: boundFromNative(event.bound),
      kind: "mate",
      value: event.mateMoves,
    }
  }

  throw new StockfishNativeSessionError(
    "invalid-search-information",
    `The native engine emitted an unknown score kind: ${event.scoreKind}.`,
    event.requestId,
  )
}

export function informationFromNative(
  event: NativeStockfishSearchInformationEvent,
): StockfishEngineSearchInformation {
  return {
    depth: event.depth,
    nodes: event.nodes,
    score: scoreFromNative(event),
    selectiveDepth: event.selectiveDepth,
  }
}

export function optionalPonderMove(value: string): string | undefined {
  if (value === "" || value === "(none)") return undefined
  assertStockfishUciMove(value, "ponderMove")
  return value
}

export function bestMoveFromNative(value: string): string | null {
  if (value === "(none)") return null
  assertStockfishUciMove(value, "bestMove")
  return value
}

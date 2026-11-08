import type { CodegenTypes, TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export type NativeStockfishConfiguration = {
  elo: CodegenTypes.Int32
  hashMegabytes: CodegenTypes.Int32
  isChess960: boolean
  limitStrength: boolean
  multiPv: CodegenTypes.Int32
  ponder: boolean
  threads: CodegenTypes.Int32
}

export type NativeStockfishSearchRequest = {
  fen: string
  moves: ReadonlyArray<string>
  nodeLimit: number
  requestId: string
}

export type NativeStockfishReadyEvent = {
  version: string
}

export type NativeStockfishSearchInformationEvent = {
  bound: string
  centipawns: CodegenTypes.Int32
  depth: CodegenTypes.Int32
  mateMoves: CodegenTypes.Int32
  nodes: number
  requestId: string
  scoreKind: string
  selectiveDepth: CodegenTypes.Int32
}

export type NativeStockfishBestMoveEvent = {
  bestMove: string
  ponderMove: string
  requestId: string
}

export type NativeStockfishFailureEvent = {
  code: string
  message: string
  requestId: string
}

export type NativeStockfishReadyMessage = {
  sessionId: string
  payload: NativeStockfishReadyEvent
}

export type NativeStockfishSearchInformationMessage = {
  sessionId: string
  payload: NativeStockfishSearchInformationEvent
}

export type NativeStockfishBestMoveMessage = {
  sessionId: string
  payload: NativeStockfishBestMoveEvent
}

export type NativeStockfishFailureMessage = {
  sessionId: string
  payload: NativeStockfishFailureEvent
}

export type NativeStockfishClosedMessage = {
  sessionId: string
}

export interface Spec extends TurboModule {
  readonly createSession: () => string
  readonly boot: (
    sessionId: string,
    configuration: NativeStockfishConfiguration,
  ) => void
  readonly close: (sessionId: string) => void
  readonly onBestMove: CodegenTypes.EventEmitter<NativeStockfishBestMoveMessage>
  readonly onClosed: CodegenTypes.EventEmitter<NativeStockfishClosedMessage>
  readonly onFailure: CodegenTypes.EventEmitter<NativeStockfishFailureMessage>
  readonly onReady: CodegenTypes.EventEmitter<NativeStockfishReadyMessage>
  readonly onSearchInformation: CodegenTypes.EventEmitter<NativeStockfishSearchInformationMessage>
  readonly startSearch: (
    sessionId: string,
    request: NativeStockfishSearchRequest,
  ) => void
  readonly stop: (sessionId: string, requestId: string) => void
}

export default TurboModuleRegistry.get<Spec>("MapachessStockfish")

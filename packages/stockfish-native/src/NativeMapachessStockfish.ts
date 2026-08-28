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

export interface Spec extends TurboModule {
  readonly boot: (configuration: NativeStockfishConfiguration) => void
  readonly close: () => void
  readonly onBestMove: CodegenTypes.EventEmitter<NativeStockfishBestMoveEvent>
  readonly onClosed: CodegenTypes.EventEmitter<void>
  readonly onFailure: CodegenTypes.EventEmitter<NativeStockfishFailureEvent>
  readonly onReady: CodegenTypes.EventEmitter<NativeStockfishReadyEvent>
  readonly onSearchInformation: CodegenTypes.EventEmitter<NativeStockfishSearchInformationEvent>
  readonly startSearch: (request: NativeStockfishSearchRequest) => void
  readonly stop: (requestId: string) => void
}

export default TurboModuleRegistry.getEnforcing<Spec>("MapachessStockfish")

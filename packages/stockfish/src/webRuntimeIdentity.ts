import {
  parseSha256Hex,
  STOCKFISH_18_SOURCE_REVISION,
  type Sha256Hex,
} from "./buildIdentity.js"
import type { StockfishUciExpectation } from "./uciTypes.js"

export const STOCKFISH_18_WEB_RUNTIME_RELATIVE_DIRECTORY =
  "apps/web/public/stockfish-runtime" as const
export const STOCKFISH_18_WEB_RELEASE_TAG = "v18.0.0" as const
export const STOCKFISH_18_WEB_SOURCE_REVISION =
  "31a98753a5d932511693f44775da908377c24513" as const

export type StockfishWebRuntimeArtifact = Readonly<{
  byteLength: number
  downloadUrl: string
  fileName: string
  sha256: Sha256Hex
}>

export const STOCKFISH_18_WEB_LOADER_ARTIFACT = {
  fileName: "stockfish-18-lite-single.js",
  byteLength: 20_670,
  sha256: parseSha256Hex(
    "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
  ),
  downloadUrl:
    "https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0/stockfish-18-lite-single.js",
} as const satisfies StockfishWebRuntimeArtifact

export const STOCKFISH_18_WEB_WASM_ARTIFACT = {
  fileName: "stockfish-18-lite-single.wasm",
  byteLength: 7_295_411,
  sha256: parseSha256Hex(
    "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
  ),
  downloadUrl:
    "https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0/stockfish-18-lite-single.wasm",
} as const satisfies StockfishWebRuntimeArtifact

export const STOCKFISH_18_WEB_RUNTIME_ARTIFACTS = [
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
] as const satisfies readonly StockfishWebRuntimeArtifact[]

export const STOCKFISH_18_WEB_UCI_EXPECTATION = {
  name: "Stockfish 18 Lite WASM",
  networkDefaults: {
    big: "nn-9067e33176e8.nnue",
    small: "<empty>",
  },
} as const satisfies StockfishUciExpectation

export const STOCKFISH_18_WEB_RUNTIME_IDENTITY = {
  releaseTag: STOCKFISH_18_WEB_RELEASE_TAG,
  stockfishJsSourceRevision: STOCKFISH_18_WEB_SOURCE_REVISION,
  upstreamStockfishSourceRevision: STOCKFISH_18_SOURCE_REVISION,
  artifacts: STOCKFISH_18_WEB_RUNTIME_ARTIFACTS,
  uciExpectation: STOCKFISH_18_WEB_UCI_EXPECTATION,
} as const

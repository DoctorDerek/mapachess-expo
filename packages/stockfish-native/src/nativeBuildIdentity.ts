import {
  parseSha256Hex,
  type Sha256Hex,
  type StockfishNetworkIdentity,
} from "@mapachess/stockfish/build-identity"

export type StockfishNativeNetworkArtifact = StockfishNetworkIdentity &
  Readonly<{
    urls: readonly [string, ...string[]]
  }>

export type StockfishNativeBuildManifest = Readonly<{
  inputId: string
  network: StockfishNativeNetworkArtifact
  schemaVersion: 2
  sourceRevision: string
  sourceSnapshotSha256: Sha256Hex
}>

export const STOCKFISH_18_LITE_SOURCE_SNAPSHOT_SHA256 = parseSha256Hex(
  "ab8c74beeead85ae5eb5c92bb0f35085a9ef17f1d451ca6e9bd5012529ccc834",
)

function networkArtifact(
  identity: StockfishNetworkIdentity,
): StockfishNativeNetworkArtifact {
  return {
    ...identity,
    urls: [
      `https://tests.stockfishchess.org/api/nn/${identity.fileName}`,
      `https://github.com/official-stockfish/networks/raw/master/${identity.fileName}`,
    ],
  }
}

export const STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST = {
  schemaVersion: 2,
  inputId: "stockfish-18-lite",
  sourceRevision: "31a98753a5d932511693f44775da908377c24513",
  sourceSnapshotSha256: STOCKFISH_18_LITE_SOURCE_SNAPSHOT_SHA256,
  network: networkArtifact({
    fileName: "nn-9067e33176e8.nnue",
    sha256: parseSha256Hex(
      "9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d",
    ),
  }),
} as const satisfies StockfishNativeBuildManifest

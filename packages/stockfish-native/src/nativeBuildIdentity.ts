import {
  parseSha256Hex,
  STOCKFISH_18_BUILD_IDENTITY,
  type Sha256Hex,
  type StockfishNetworkIdentity,
} from "@mapachess/stockfish/build-identity"

export type StockfishNativeNetworkArtifact = StockfishNetworkIdentity &
  Readonly<{
    urls: readonly [string, ...string[]]
  }>

export type StockfishNativeBuildManifest = Readonly<{
  networks: Readonly<{
    big: StockfishNativeNetworkArtifact
    small: StockfishNativeNetworkArtifact
  }>
  releaseTag: string
  schemaVersion: 1
  sourceRevision: string
  sourceSnapshotSha256: Sha256Hex
}>

export const STOCKFISH_18_SOURCE_SNAPSHOT_SHA256 = parseSha256Hex(
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

export const STOCKFISH_18_NATIVE_BUILD_MANIFEST = {
  schemaVersion: 1,
  releaseTag: STOCKFISH_18_BUILD_IDENTITY.releaseTag,
  sourceRevision: "31a98753a5d932511693f44775da908377c24513",
  sourceSnapshotSha256: STOCKFISH_18_SOURCE_SNAPSHOT_SHA256,
  networks: {
    big: networkArtifact(STOCKFISH_18_BUILD_IDENTITY.networks.big),
    small: networkArtifact(STOCKFISH_18_BUILD_IDENTITY.networks.small),
  },
} as const satisfies StockfishNativeBuildManifest

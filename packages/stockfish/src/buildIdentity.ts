const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/
const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

declare const sha256HexBrand: unique symbol

export type Sha256Hex = string & { readonly [sha256HexBrand]: true }
export type StockfishRuntimeTarget = "linux-x64" | "windows-x64"

export type StockfishNetworkIdentity = Readonly<{
  fileName: string
  sha256: Sha256Hex
}>

export type StockfishBuildIdentity = Readonly<{
  archiveSha256: Sha256Hex
  executableSha256: Sha256Hex
  name: "stockfish"
  networks: Readonly<{
    big: StockfishNetworkIdentity
    small: StockfishNetworkIdentity
  }>
  releaseTag: string
  sourceRevision: string
  version: string
}>

export type StockfishReleaseArtifact = Readonly<{
  archiveFileName: string
  archiveFormat: "tar" | "zip"
  archiveSha256: Sha256Hex
  archiveTopLevelDirectory: string
  archiveUrl: string
  executableRelativePath: string
  executableSha256: Sha256Hex
  licenseRelativePath: string
  sourceDirectoryRelativePath: string
  target: StockfishRuntimeTarget
}>

export function parseSha256Hex(value: string, label = "SHA-256"): Sha256Hex {
  if (!SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(
      `${label} must be exactly 64 lowercase hexadecimal characters.`,
    )
  }

  return value as Sha256Hex
}

function assertStableText(value: string, label: string): void {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${label} must be nonempty, trimmed, and free of control characters.`,
    )
  }
}

function validateNetworkIdentity(
  network: StockfishNetworkIdentity,
  label: string,
): void {
  assertStableText(network.fileName, `${label}.fileName`)
  parseSha256Hex(network.sha256, `${label}.sha256`)

  const expectedFileName = `nn-${network.sha256.slice(0, 12)}.nnue`
  if (network.fileName !== expectedFileName) {
    throw new TypeError(`${label}.fileName must be ${expectedFileName}.`)
  }
}

export function validateStockfishBuildIdentity(
  identity: StockfishBuildIdentity,
): void {
  if (identity.name !== "stockfish") {
    throw new TypeError('name must be "stockfish".')
  }

  assertStableText(identity.version, "version")
  assertStableText(identity.releaseTag, "releaseTag")

  if (!SOURCE_REVISION_PATTERN.test(identity.sourceRevision)) {
    throw new TypeError(
      "sourceRevision must be exactly 40 lowercase hexadecimal characters.",
    )
  }

  parseSha256Hex(identity.archiveSha256, "archiveSha256")
  parseSha256Hex(identity.executableSha256, "executableSha256")
  validateNetworkIdentity(identity.networks.big, "networks.big")
  validateNetworkIdentity(identity.networks.small, "networks.small")

  if (identity.networks.big.sha256 === identity.networks.small.sha256) {
    throw new TypeError("The big and small NNUE networks must be distinct.")
  }
}

const STOCKFISH_18_COMMON = {
  name: "stockfish",
  version: "18",
  releaseTag: "sf_18",
  sourceRevision: "cb3d4ee9b47d0c5aae855b12379378ea1439675c",
  networks: {
    big: {
      fileName: "nn-c288c895ea92.nnue",
      sha256:
        "c288c895ea924429ea9092e3f36b2b3c1f00f2a3a4c759ff7e57e79e3b43e4a7" as Sha256Hex,
    },
    small: {
      fileName: "nn-37f18f62d772.nnue",
      sha256:
        "37f18f62d772f3107e1d6aaca3898c130c3c86f2ab63e6555fbbca20635a899d" as Sha256Hex,
    },
  },
} as const

export const STOCKFISH_18_ARTIFACTS: Readonly<
  Record<StockfishRuntimeTarget, StockfishReleaseArtifact>
> = {
  "windows-x64": {
    target: "windows-x64",
    archiveFileName: "stockfish-windows-x86-64.zip",
    archiveFormat: "zip",
    archiveSha256:
      "40cc975817e7eee270b03f354810d20956df565420d320f6dd37d454dc81a139" as Sha256Hex,
    archiveUrl:
      "https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-windows-x86-64.zip",
    archiveTopLevelDirectory: "stockfish",
    executableRelativePath: "stockfish-windows-x86-64.exe",
    executableSha256:
      "9bde420202717ce083412027fbfb8c5c935b537591d712be8a8a8bae92f6e8d6" as Sha256Hex,
    licenseRelativePath: "Copying.txt",
    sourceDirectoryRelativePath: "src",
  },
  "linux-x64": {
    target: "linux-x64",
    archiveFileName: "stockfish-ubuntu-x86-64.tar",
    archiveFormat: "tar",
    archiveSha256:
      "5c6f38b02a4da5f3ffe763f27da6c3e743eebefd92b50cb3661623b96696adff" as Sha256Hex,
    archiveUrl:
      "https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64.tar",
    archiveTopLevelDirectory: "stockfish",
    executableRelativePath: "stockfish-ubuntu-x86-64",
    executableSha256:
      "7a44d64fd877ee888a5160349827563444e1935ca6c1095d0f8e0859d57101c7" as Sha256Hex,
    licenseRelativePath: "Copying.txt",
    sourceDirectoryRelativePath: "src",
  },
}

export function createStockfish18BuildIdentity(
  target: StockfishRuntimeTarget,
): StockfishBuildIdentity {
  const artifact = STOCKFISH_18_ARTIFACTS[target]
  const identity: StockfishBuildIdentity = {
    ...STOCKFISH_18_COMMON,
    archiveSha256: artifact.archiveSha256,
    executableSha256: artifact.executableSha256,
  }

  validateStockfishBuildIdentity(identity)
  return identity
}

export function stockfishRuntimeTargetForHost(
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): StockfishRuntimeTarget {
  if (architecture !== "x64") {
    throw new TypeError(
      `Stockfish 18 provisioning does not support ${platform}-${architecture}.`,
    )
  }

  if (platform === "win32") return "windows-x64"
  if (platform === "linux") return "linux-x64"

  throw new TypeError(
    `Stockfish 18 provisioning does not support ${platform}-${architecture}.`,
  )
}

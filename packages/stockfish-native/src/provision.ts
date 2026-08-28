import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import {
  parseSha256Hex,
  type Sha256Hex,
} from "@mapachess/stockfish/build-identity"
import {
  STOCKFISH_18_NATIVE_BUILD_MANIFEST,
  type StockfishNativeBuildManifest,
  type StockfishNativeNetworkArtifact,
} from "./nativeBuildIdentity.js"
import { sha256StockfishSourceSnapshot } from "./sourceSnapshot.js"

const PROVISIONING_MARKER_FILE_NAME = ".mapachess-stockfish-networks.json"

export type StockfishNativeInputPaths = Readonly<{
  installDirectory: string
  markerPath: string
  networks: Readonly<{
    big: string
    small: string
  }>
  sourceDirectory: string
}>

export type StockfishNativeNetworkDownload = (
  url: string,
) => Promise<Uint8Array>

export type StockfishNativeNetworkProvisionInput = Readonly<{
  download?: StockfishNativeNetworkDownload
  manifest?: StockfishNativeBuildManifest
  packageRoot: string
}>

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error) {
    if (isMissingPath(error)) return false
    throw error
  }
}

function assertPathWithin(
  parent: string,
  candidate: string,
  label: string,
): void {
  const relativePath = relative(parent, candidate)

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath)
  ) {
    throw new TypeError(`${label} must resolve inside ${parent}.`)
  }
}

function validateNetworkArtifact(
  artifact: StockfishNativeNetworkArtifact,
  label: string,
): void {
  parseSha256Hex(artifact.sha256, `${label}.sha256`)

  if (
    artifact.fileName.includes("/") ||
    artifact.fileName.includes("\\") ||
    artifact.fileName !== `nn-${artifact.sha256.slice(0, 12)}.nnue`
  ) {
    throw new TypeError(`${label}.fileName does not match its SHA-256.`)
  }

  if (
    artifact.urls.length === 0 ||
    artifact.urls.some((url) => new URL(url).protocol !== "https:")
  ) {
    throw new TypeError(`${label}.urls must contain only HTTPS URLs.`)
  }
}

function validateManifest(manifest: StockfishNativeBuildManifest): void {
  if (manifest.schemaVersion !== 1) {
    throw new TypeError("Native Stockfish manifest schemaVersion must be 1.")
  }

  if (!/^[0-9a-f]{40}$/.test(manifest.sourceRevision)) {
    throw new TypeError(
      "Native Stockfish sourceRevision must be a lowercase Git revision.",
    )
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(manifest.releaseTag)) {
    throw new TypeError(
      "Native Stockfish releaseTag must be a safe path segment.",
    )
  }

  parseSha256Hex(manifest.sourceSnapshotSha256, "sourceSnapshotSha256")
  validateNetworkArtifact(manifest.networks.big, "networks.big")
  validateNetworkArtifact(manifest.networks.small, "networks.small")

  if (manifest.networks.big.sha256 === manifest.networks.small.sha256) {
    throw new TypeError("Native Stockfish networks must be distinct.")
  }
}

function resolveInputPaths(
  packageRoot: string,
  manifest: StockfishNativeBuildManifest,
): StockfishNativeInputPaths {
  const resolvedPackageRoot = resolve(packageRoot)
  const sourceDirectory = resolve(
    resolvedPackageRoot,
    "third_party",
    "stockfish",
  )
  const storageDirectory = resolve(resolvedPackageRoot, ".stockfish-networks")
  const installDirectory = resolve(storageDirectory, manifest.releaseTag)
  const markerPath = resolve(installDirectory, PROVISIONING_MARKER_FILE_NAME)
  const bigNetworkPath = resolve(
    installDirectory,
    manifest.networks.big.fileName,
  )
  const smallNetworkPath = resolve(
    installDirectory,
    manifest.networks.small.fileName,
  )

  assertPathWithin(resolvedPackageRoot, sourceDirectory, "Stockfish source")
  assertPathWithin(
    resolvedPackageRoot,
    storageDirectory,
    "Stockfish network storage",
  )
  assertPathWithin(
    storageDirectory,
    installDirectory,
    "Stockfish network installation",
  )
  assertPathWithin(installDirectory, markerPath, "Stockfish network marker")
  assertPathWithin(installDirectory, bigNetworkPath, "Stockfish big network")
  assertPathWithin(
    installDirectory,
    smallNetworkPath,
    "Stockfish small network",
  )

  return {
    sourceDirectory,
    installDirectory,
    markerPath,
    networks: { big: bigNetworkPath, small: smallNetworkPath },
  }
}

async function sha256File(path: string): Promise<Sha256Hex> {
  const digest = createHash("sha256")

  for await (const chunk of createReadStream(path)) digest.update(chunk)

  return parseSha256Hex(digest.digest("hex"))
}

function sha256Bytes(bytes: Uint8Array): Sha256Hex {
  return parseSha256Hex(createHash("sha256").update(bytes).digest("hex"))
}

async function defaultDownload(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`download failed with HTTP ${response.status}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

async function downloadVerifiedNetwork(
  artifact: StockfishNativeNetworkArtifact,
  download: StockfishNativeNetworkDownload,
): Promise<Uint8Array> {
  const failures: string[] = []

  for (const url of artifact.urls) {
    try {
      const bytes = await download(url)
      const actualSha256 = sha256Bytes(bytes)
      if (actualSha256 !== artifact.sha256) {
        throw new Error(
          `SHA-256 mismatch: expected ${artifact.sha256}, received ${actualSha256}`,
        )
      }

      return bytes
    } catch (error) {
      failures.push(`${url}: ${String(error)}`)
    }
  }

  throw new Error(
    `Unable to provision ${artifact.fileName}. ${failures.join(" | ")}`,
  )
}

async function validateInstalledNetworks(
  paths: StockfishNativeInputPaths,
  manifest: StockfishNativeBuildManifest,
): Promise<void> {
  const marker = JSON.parse(await readFile(paths.markerPath, "utf8")) as unknown
  if (JSON.stringify(marker) !== JSON.stringify(manifest)) {
    throw new Error("Native Stockfish network marker does not match the pin.")
  }

  const [bigSha256, smallSha256] = await Promise.all([
    sha256File(paths.networks.big),
    sha256File(paths.networks.small),
  ])
  if (bigSha256 !== manifest.networks.big.sha256) {
    throw new Error("Native Stockfish big-network SHA-256 mismatch.")
  }
  if (smallSha256 !== manifest.networks.small.sha256) {
    throw new Error("Native Stockfish small-network SHA-256 mismatch.")
  }
}

export async function provisionStockfishNativeNetworks(
  input: StockfishNativeNetworkProvisionInput,
): Promise<StockfishNativeInputPaths> {
  const manifest = input.manifest ?? STOCKFISH_18_NATIVE_BUILD_MANIFEST
  const download = input.download ?? defaultDownload
  validateManifest(manifest)
  const paths = resolveInputPaths(input.packageRoot, manifest)

  if (await pathExists(paths.installDirectory)) {
    await validateInstalledNetworks(paths, manifest)
    return paths
  }

  const storageDirectory = dirname(paths.installDirectory)
  await mkdir(storageDirectory, { recursive: true })
  const stagingDirectory = await mkdtemp(join(storageDirectory, ".provision-"))
  const stagedInstallDirectory = resolve(stagingDirectory, "inputs")
  assertPathWithin(
    storageDirectory,
    stagingDirectory,
    "Stockfish network staging",
  )
  assertPathWithin(
    stagingDirectory,
    stagedInstallDirectory,
    "Stockfish staged inputs",
  )

  try {
    await mkdir(stagedInstallDirectory)
    const [bigBytes, smallBytes] = await Promise.all([
      downloadVerifiedNetwork(manifest.networks.big, download),
      downloadVerifiedNetwork(manifest.networks.small, download),
    ])
    await Promise.all([
      writeFile(
        resolve(stagedInstallDirectory, manifest.networks.big.fileName),
        bigBytes,
      ),
      writeFile(
        resolve(stagedInstallDirectory, manifest.networks.small.fileName),
        smallBytes,
      ),
      writeFile(
        resolve(stagedInstallDirectory, PROVISIONING_MARKER_FILE_NAME),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      ),
    ])

    await validateInstalledNetworks(
      {
        ...paths,
        installDirectory: stagedInstallDirectory,
        markerPath: resolve(
          stagedInstallDirectory,
          PROVISIONING_MARKER_FILE_NAME,
        ),
        networks: {
          big: resolve(stagedInstallDirectory, manifest.networks.big.fileName),
          small: resolve(
            stagedInstallDirectory,
            manifest.networks.small.fileName,
          ),
        },
      },
      manifest,
    )
    await rename(stagedInstallDirectory, paths.installDirectory)
    await validateInstalledNetworks(paths, manifest)
    return paths
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true })
  }
}

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..")
}

export default async function provisionStockfishNativeInputs(
  packageRoot = defaultPackageRoot(),
): Promise<StockfishNativeInputPaths> {
  const manifest = STOCKFISH_18_NATIVE_BUILD_MANIFEST
  const paths = resolveInputPaths(packageRoot, manifest)
  const sourceSnapshotSha256 = await sha256StockfishSourceSnapshot(
    paths.sourceDirectory,
  )
  if (sourceSnapshotSha256 !== manifest.sourceSnapshotSha256) {
    throw new Error(
      `Stockfish source snapshot SHA-256 mismatch: expected ${manifest.sourceSnapshotSha256}, received ${sourceSnapshotSha256}.`,
    )
  }

  return provisionStockfishNativeNetworks({ packageRoot, manifest })
}

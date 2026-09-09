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
  STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST,
  type StockfishNativeBuildManifest,
  type StockfishNativeNetworkArtifact,
} from "./nativeBuildIdentity.js"
import { sha256StockfishSourceSnapshot } from "./sourceSnapshot.js"

const PROVISIONING_MARKER_FILE_NAME = ".mapachess-stockfish-networks.json"

export type StockfishNativeInputPaths = Readonly<{
  installDirectory: string
  markerPath: string
  networkPath: string
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
  if (manifest.schemaVersion !== 2) {
    throw new TypeError("Native Stockfish manifest schemaVersion must be 2.")
  }

  if (!/^[0-9a-f]{40}$/.test(manifest.sourceRevision)) {
    throw new TypeError(
      "Native Stockfish sourceRevision must be a lowercase Git revision.",
    )
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(manifest.inputId)) {
    throw new TypeError("Native Stockfish inputId must be a safe path segment.")
  }

  parseSha256Hex(manifest.sourceSnapshotSha256, "sourceSnapshotSha256")
  validateNetworkArtifact(manifest.network, "network")
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
  const installDirectory = resolve(storageDirectory, manifest.inputId)
  const markerPath = resolve(installDirectory, PROVISIONING_MARKER_FILE_NAME)
  const networkPath = resolve(installDirectory, manifest.network.fileName)

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
  assertPathWithin(installDirectory, networkPath, "Stockfish Lite network")

  return {
    sourceDirectory,
    installDirectory,
    markerPath,
    networkPath,
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

async function validateInstalledNetwork(
  paths: StockfishNativeInputPaths,
  manifest: StockfishNativeBuildManifest,
): Promise<void> {
  const marker = JSON.parse(await readFile(paths.markerPath, "utf8")) as unknown
  if (JSON.stringify(marker) !== JSON.stringify(manifest)) {
    throw new Error("Native Stockfish network marker does not match the pin.")
  }

  const networkSha256 = await sha256File(paths.networkPath)
  if (networkSha256 !== manifest.network.sha256) {
    throw new Error("Native Stockfish network SHA-256 mismatch.")
  }
}

export async function provisionStockfishNativeNetwork(
  input: StockfishNativeNetworkProvisionInput,
): Promise<StockfishNativeInputPaths> {
  const manifest = input.manifest ?? STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST
  const download = input.download ?? defaultDownload
  validateManifest(manifest)
  const paths = resolveInputPaths(input.packageRoot, manifest)

  if (await pathExists(paths.installDirectory)) {
    await validateInstalledNetwork(paths, manifest)
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
    const networkBytes = await downloadVerifiedNetwork(
      manifest.network,
      download,
    )
    await Promise.all([
      writeFile(
        resolve(stagedInstallDirectory, manifest.network.fileName),
        networkBytes,
      ),
      writeFile(
        resolve(stagedInstallDirectory, PROVISIONING_MARKER_FILE_NAME),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      ),
    ])

    await validateInstalledNetwork(
      {
        ...paths,
        installDirectory: stagedInstallDirectory,
        markerPath: resolve(
          stagedInstallDirectory,
          PROVISIONING_MARKER_FILE_NAME,
        ),
        networkPath: resolve(stagedInstallDirectory, manifest.network.fileName),
      },
      manifest,
    )
    await rename(stagedInstallDirectory, paths.installDirectory)
    await validateInstalledNetwork(paths, manifest)
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
  const manifest = STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST
  const paths = resolveInputPaths(packageRoot, manifest)
  const sourceSnapshotSha256 = await sha256StockfishSourceSnapshot(
    paths.sourceDirectory,
  )
  if (sourceSnapshotSha256 !== manifest.sourceSnapshotSha256) {
    throw new Error(
      `Stockfish source snapshot SHA-256 mismatch: expected ${manifest.sourceSnapshotSha256}, received ${sourceSnapshotSha256}.`,
    )
  }

  return provisionStockfishNativeNetwork({ packageRoot, manifest })
}

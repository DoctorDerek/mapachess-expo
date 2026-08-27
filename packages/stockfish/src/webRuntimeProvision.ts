import { createHash } from "node:crypto"
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import type { Sha256Hex } from "./buildIdentity.js"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_RUNTIME_ARTIFACTS,
  STOCKFISH_18_WEB_RUNTIME_IDENTITY,
  STOCKFISH_18_WEB_RUNTIME_RELATIVE_DIRECTORY,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
  type StockfishWebRuntimeArtifact,
} from "./webRuntimeIdentity.js"

const WEB_RUNTIME_MARKER_SCHEMA_VERSION = 1 as const
const WEB_RUNTIME_MARKER_FILE_NAME = ".mapachess-stockfish-web.json"

type WebRuntimeMarker = Readonly<{
  schemaVersion: typeof WEB_RUNTIME_MARKER_SCHEMA_VERSION
  identity: typeof STOCKFISH_18_WEB_RUNTIME_IDENTITY
}>

export type ProvisionedStockfishWebRuntime = Readonly<{
  loaderPath: string
  runtimeDirectory: string
  wasmPath: string
}>

export type StockfishWebRuntimeProvisionOptions = Readonly<{
  fetchImplementation?: typeof fetch
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
    relativePath.startsWith(`..\\`) ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath)
  ) {
    throw new TypeError(`${label} must resolve inside ${parent}.`)
  }
}

export function resolveStockfishWebRuntimeDirectory(
  workspaceRoot: string,
): string {
  const resolvedWorkspaceRoot = resolve(workspaceRoot)
  const runtimeDirectory = resolve(
    resolvedWorkspaceRoot,
    STOCKFISH_18_WEB_RUNTIME_RELATIVE_DIRECTORY,
  )

  assertPathWithin(
    resolvedWorkspaceRoot,
    runtimeDirectory,
    "Stockfish web runtime",
  )
  return runtimeDirectory
}

function sha256Bytes(bytes: Uint8Array): Sha256Hex {
  return createHash("sha256").update(bytes).digest("hex") as Sha256Hex
}

export function validateWebRuntimeArtifactBytes(
  bytes: Uint8Array,
  artifact: StockfishWebRuntimeArtifact,
): void {
  if (bytes.byteLength !== artifact.byteLength) {
    throw new Error(
      `${artifact.fileName} byte length mismatch: expected ${artifact.byteLength}, received ${bytes.byteLength}.`,
    )
  }

  const actualSha256 = sha256Bytes(bytes)
  if (actualSha256 !== artifact.sha256) {
    throw new Error(
      `${artifact.fileName} SHA-256 mismatch: expected ${artifact.sha256}, received ${actualSha256}.`,
    )
  }
}

function createWebRuntimeMarker(): WebRuntimeMarker {
  return {
    schemaVersion: WEB_RUNTIME_MARKER_SCHEMA_VERSION,
    identity: STOCKFISH_18_WEB_RUNTIME_IDENTITY,
  }
}

function provisionedRuntime(
  runtimeDirectory: string,
): ProvisionedStockfishWebRuntime {
  return {
    runtimeDirectory,
    loaderPath: resolve(
      runtimeDirectory,
      STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName,
    ),
    wasmPath: resolve(
      runtimeDirectory,
      STOCKFISH_18_WEB_WASM_ARTIFACT.fileName,
    ),
  }
}

async function validateRuntimeDirectory(
  runtimeDirectory: string,
): Promise<ProvisionedStockfishWebRuntime> {
  const expectedNames = [
    ...STOCKFISH_18_WEB_RUNTIME_ARTIFACTS.map((artifact) => artifact.fileName),
    WEB_RUNTIME_MARKER_FILE_NAME,
  ].sort()
  const actualNames = (await readdir(runtimeDirectory)).sort()

  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      "Stockfish web runtime directory does not match the pinned file set.",
    )
  }

  for (const artifact of STOCKFISH_18_WEB_RUNTIME_ARTIFACTS) {
    const artifactPath = resolve(runtimeDirectory, artifact.fileName)
    assertPathWithin(runtimeDirectory, artifactPath, artifact.fileName)
    const artifactStat = await stat(artifactPath)
    if (!artifactStat.isFile()) {
      throw new Error(`${artifact.fileName} must be a file.`)
    }

    validateWebRuntimeArtifactBytes(await readFile(artifactPath), artifact)
  }

  const markerPath = resolve(runtimeDirectory, WEB_RUNTIME_MARKER_FILE_NAME)
  assertPathWithin(runtimeDirectory, markerPath, "Stockfish web marker")
  const marker = JSON.parse(await readFile(markerPath, "utf8")) as unknown
  if (JSON.stringify(marker) !== JSON.stringify(createWebRuntimeMarker())) {
    throw new Error("Stockfish web runtime marker does not match the pin.")
  }

  return provisionedRuntime(runtimeDirectory)
}

async function downloadArtifact(
  artifact: StockfishWebRuntimeArtifact,
  destinationDirectory: string,
  fetchImplementation: typeof fetch,
): Promise<void> {
  const response = await fetchImplementation(artifact.downloadUrl)
  if (!response.ok) {
    throw new Error(
      `${artifact.fileName} download failed with HTTP ${response.status}.`,
    )
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  validateWebRuntimeArtifactBytes(bytes, artifact)
  const destinationPath = resolve(destinationDirectory, artifact.fileName)
  assertPathWithin(destinationDirectory, destinationPath, artifact.fileName)
  await writeFile(destinationPath, bytes)
}

export default async function provisionStockfishWebRuntime(
  workspaceRoot: string,
  options: StockfishWebRuntimeProvisionOptions = {},
): Promise<ProvisionedStockfishWebRuntime> {
  const runtimeDirectory = resolveStockfishWebRuntimeDirectory(workspaceRoot)
  if (await pathExists(runtimeDirectory)) {
    return validateRuntimeDirectory(runtimeDirectory)
  }

  const runtimeParent = dirname(runtimeDirectory)
  await mkdir(runtimeParent, { recursive: true })
  const stagingDirectory = await mkdtemp(
    join(runtimeParent, ".stockfish-runtime-"),
  )
  assertPathWithin(
    runtimeParent,
    stagingDirectory,
    "Stockfish web staging directory",
  )

  try {
    const fetchImplementation = options.fetchImplementation ?? fetch
    await Promise.all(
      STOCKFISH_18_WEB_RUNTIME_ARTIFACTS.map((artifact) =>
        downloadArtifact(artifact, stagingDirectory, fetchImplementation),
      ),
    )
    await writeFile(
      resolve(stagingDirectory, WEB_RUNTIME_MARKER_FILE_NAME),
      `${JSON.stringify(createWebRuntimeMarker(), null, 2)}\n`,
      "utf8",
    )
    await validateRuntimeDirectory(stagingDirectory)

    try {
      await rename(stagingDirectory, runtimeDirectory)
    } catch (error) {
      if (!(await pathExists(runtimeDirectory))) throw error
    }

    return await validateRuntimeDirectory(runtimeDirectory)
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true })
  }
}

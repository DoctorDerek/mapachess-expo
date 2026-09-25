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
const WEB_RUNTIME_MIRROR_URL = "https://www.mapachess.com/stockfish-runtime/"
const DOWNLOAD_TIMEOUT_MS = 20_000
const MAX_RETRY_AFTER_MS = 10_000
const UPSTREAM_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1_000

type DownloadAttempt =
  | Readonly<{ ok: true; bytes: Uint8Array }>
  | Readonly<{ ok: false; reason: string; retryAfterMs: number | null }>

export type VerifiedWebRuntimeDownload = Readonly<{
  bytes: Uint8Array
  recovery: string | null
}>

type WebRuntimeMarker = Readonly<{
  schemaVersion: typeof WEB_RUNTIME_MARKER_SCHEMA_VERSION
  identity: typeof STOCKFISH_18_WEB_RUNTIME_IDENTITY
}>

export type ProvisionedStockfishWebRuntime = Readonly<{
  loaderPath: string
  runtimeDirectory: string
  wasmPath: string
  downloadRecoveries: readonly string[]
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
    downloadRecoveries: [],
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

function retryAfterMilliseconds(header: string | null): number | null {
  if (header === null) return 0
  if (!/^\d+$/.test(header) && !/^[A-Za-z]/.test(header)) return null
  const delay = /^\d+$/.test(header)
    ? Number(header) * 1_000
    : Math.max(0, Date.parse(header) - Date.now())
  return Number.isFinite(delay) && delay <= MAX_RETRY_AFTER_MS ? delay : null
}

async function attemptArtifactDownload(
  url: string,
  fetchImplementation: typeof fetch,
): Promise<DownloadAttempt> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error("download timed out")),
    DOWNLOAD_TIMEOUT_MS,
  )
  try {
    const response = await fetchImplementation(url, {
      signal: controller.signal,
    })
    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after")
      const retryable =
        [408, 429, 500, 502, 503, 504].includes(response.status) &&
        (response.status !== 429 || retryAfter !== null)
      return {
        ok: false,
        reason: `HTTP ${response.status}`,
        retryAfterMs: retryable ? retryAfterMilliseconds(retryAfter) : null,
      }
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    return { ok: true, bytes }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      retryAfterMs: 0,
    }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

export async function fetchVerifiedWebRuntimeArtifact(
  artifact: StockfishWebRuntimeArtifact,
  fetchImplementation: typeof fetch = fetch,
): Promise<VerifiedWebRuntimeDownload> {
  const failures: string[] = []
  for (let attempt = 1; attempt <= UPSTREAM_ATTEMPTS; attempt += 1) {
    const upstream = await attemptArtifactDownload(
      artifact.downloadUrl,
      fetchImplementation,
    )
    if (upstream.ok) {
      validateWebRuntimeArtifactBytes(upstream.bytes, artifact)
      return {
        bytes: upstream.bytes,
        recovery:
          attempt === 1
            ? null
            : `${artifact.fileName}: GitHub succeeded on attempt ${attempt} (${failures.join("; ")})`,
      }
    }
    failures.push(`GitHub attempt ${attempt}: ${upstream.reason}`)
    if (upstream.retryAfterMs === null || attempt === UPSTREAM_ATTEMPTS) break
    const delay = Math.max(
      RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
      upstream.retryAfterMs,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, delay))
  }
  const mirror = await attemptArtifactDownload(
    new URL(artifact.fileName, WEB_RUNTIME_MIRROR_URL).href,
    fetchImplementation,
  )
  if (mirror.ok) {
    validateWebRuntimeArtifactBytes(mirror.bytes, artifact)
    return {
      bytes: mirror.bytes,
      recovery: `${artifact.fileName}: Mapachess fallback succeeded (${failures.join("; ")})`,
    }
  }
  failures.push(`Mapachess fallback: ${mirror.reason}`)
  throw new Error(
    `${artifact.fileName} download failed (${failures.join("; ")}).`,
  )
}

async function downloadArtifact(
  artifact: StockfishWebRuntimeArtifact,
  destinationDirectory: string,
  fetchImplementation: typeof fetch,
): Promise<string | null> {
  const download = await fetchVerifiedWebRuntimeArtifact(
    artifact,
    fetchImplementation,
  )
  const destinationPath = resolve(destinationDirectory, artifact.fileName)
  assertPathWithin(destinationDirectory, destinationPath, artifact.fileName)
  await writeFile(destinationPath, download.bytes)
  return download.recovery
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
    const downloads = await Promise.allSettled(
      STOCKFISH_18_WEB_RUNTIME_ARTIFACTS.map((artifact) =>
        downloadArtifact(artifact, stagingDirectory, fetchImplementation),
      ),
    )
    const downloadRecoveries: string[] = []
    for (const download of downloads) {
      if (download.status === "rejected") {
        const failure: unknown = download.reason
        throw failure
      }
      if (download.value !== null) downloadRecoveries.push(download.value)
    }
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

    const provisioned = await validateRuntimeDirectory(runtimeDirectory)
    return { ...provisioned, downloadRecoveries }
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true })
  }
}

import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { promisify } from "node:util"
import {
  STOCKFISH_18_ARTIFACT,
  STOCKFISH_18_BUILD_IDENTITY,
  STOCKFISH_18_RUNTIME_TARGET,
  validateStockfish18Host,
  validateStockfishBuildIdentity,
  type Sha256Hex,
  type StockfishBuildIdentity,
  type StockfishReleaseArtifact,
  type StockfishRuntimeTarget,
} from "./buildIdentity.js"

const execFileAsync = promisify(execFile)
const PROVISIONING_MARKER_SCHEMA_VERSION = 1 as const
const PROVISIONING_MARKER_FILE_NAME = ".mapachess-stockfish.json"

type ProvisioningMarker = Readonly<{
  schemaVersion: typeof PROVISIONING_MARKER_SCHEMA_VERSION
  artifact: StockfishReleaseArtifact
  identity: StockfishBuildIdentity
}>

export type ProvisionedStockfish = Readonly<{
  executablePath: string
  identity: StockfishBuildIdentity
  installDirectory: string
  target: StockfishRuntimeTarget
}>

export type StockfishInstallPaths = Readonly<{
  executablePath: string
  installDirectory: string
  markerPath: string
  storageDirectory: string
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

function assertSafeRelativePath(value: string, label: string): void {
  const normalized = value.replaceAll("\\", "/")
  const segments = normalized.split("/")

  if (
    value.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    segments.includes("..") ||
    value.includes("\0")
  ) {
    throw new TypeError(`${label} must be a safe relative path.`)
  }
}

export function validateArchiveEntryPaths(
  entries: readonly string[],
  expectedTopLevelDirectory: string,
): void {
  if (entries.length === 0) {
    throw new TypeError("Stockfish archive must not be empty.")
  }

  assertSafeRelativePath(
    expectedTopLevelDirectory,
    "archive top-level directory",
  )
  const expectedPrefix = `${expectedTopLevelDirectory}/`

  for (const entry of entries) {
    assertSafeRelativePath(entry, "archive entry")
    const normalized = entry.replaceAll("\\", "/")

    if (
      normalized !== expectedTopLevelDirectory &&
      !normalized.startsWith(expectedPrefix)
    ) {
      throw new TypeError(
        `Stockfish archive entry must stay under ${expectedTopLevelDirectory}/.`,
      )
    }
  }
}

export function resolveStockfishInstallPaths(
  workspaceRoot: string,
): StockfishInstallPaths {
  const resolvedWorkspaceRoot = resolve(workspaceRoot)
  const storageDirectory = resolve(resolvedWorkspaceRoot, ".stockfish")
  const installDirectory = resolve(
    storageDirectory,
    "sf_18",
    STOCKFISH_18_RUNTIME_TARGET,
  )
  const executablePath = resolve(
    installDirectory,
    STOCKFISH_18_ARTIFACT.executableRelativePath,
  )
  const markerPath = resolve(installDirectory, PROVISIONING_MARKER_FILE_NAME)

  assertPathWithin(resolvedWorkspaceRoot, storageDirectory, "Stockfish storage")
  assertPathWithin(storageDirectory, installDirectory, "Stockfish installation")
  assertPathWithin(installDirectory, executablePath, "Stockfish executable")
  assertPathWithin(installDirectory, markerPath, "Stockfish marker")

  return { storageDirectory, installDirectory, executablePath, markerPath }
}

export async function sha256File(path: string): Promise<Sha256Hex> {
  const digest = createHash("sha256")
  const stream = createReadStream(path)

  for await (const chunk of stream) digest.update(chunk)

  return digest.digest("hex") as Sha256Hex
}

async function assertFileDigest(
  path: string,
  expectedSha256: Sha256Hex,
  label: string,
): Promise<void> {
  const actualSha256 = await sha256File(path)

  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `${label} SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}.`,
    )
  }
}

function createProvisioningMarker(
  artifact: StockfishReleaseArtifact,
  identity: StockfishBuildIdentity,
): ProvisioningMarker {
  return {
    schemaVersion: PROVISIONING_MARKER_SCHEMA_VERSION,
    artifact,
    identity,
  }
}

async function assertDirectory(path: string, label: string): Promise<void> {
  const pathStat = await stat(path)

  if (!pathStat.isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}.`)
  }
}

async function assertFile(path: string, label: string): Promise<void> {
  const pathStat = await stat(path)

  if (!pathStat.isFile()) {
    throw new Error(`${label} must be a file: ${path}.`)
  }
}

async function validateInstalledTree(
  paths: StockfishInstallPaths,
  artifact: StockfishReleaseArtifact,
  identity: StockfishBuildIdentity,
): Promise<ProvisionedStockfish> {
  const sourceDirectory = resolve(
    paths.installDirectory,
    artifact.sourceDirectoryRelativePath,
  )
  const licensePath = resolve(
    paths.installDirectory,
    artifact.licenseRelativePath,
  )

  assertPathWithin(paths.installDirectory, sourceDirectory, "Stockfish source")
  assertPathWithin(paths.installDirectory, licensePath, "Stockfish license")
  await assertDirectory(sourceDirectory, "Stockfish source")
  await assertFile(licensePath, "Stockfish GPL license")
  await assertFile(paths.executablePath, "Stockfish executable")
  await assertFileDigest(
    paths.executablePath,
    artifact.executableSha256,
    "Stockfish executable",
  )

  const expectedMarker = createProvisioningMarker(artifact, identity)
  const actualMarker = JSON.parse(
    await readFile(paths.markerPath, "utf8"),
  ) as unknown

  if (JSON.stringify(actualMarker) !== JSON.stringify(expectedMarker)) {
    throw new Error("Stockfish provisioning marker does not match the pin.")
  }

  return {
    target: artifact.target,
    identity,
    installDirectory: paths.installDirectory,
    executablePath: paths.executablePath,
  }
}

async function downloadArchive(
  url: string,
  destination: string,
): Promise<void> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Stockfish archive download failed with HTTP ${response.status}.`,
    )
  }

  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

async function listArchiveEntries(archivePath: string): Promise<string[]> {
  const { stdout } = await execFileAsync("tar", ["-tf", archivePath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })

  return stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

async function extractArchive(
  archivePath: string,
  destination: string,
): Promise<void> {
  await execFileAsync("tar", ["-xf", archivePath, "-C", destination], {
    maxBuffer: 16 * 1024 * 1024,
  })
}

export default async function provisionStockfish18(
  workspaceRoot: string,
): Promise<ProvisionedStockfish> {
  validateStockfish18Host()
  validateStockfishBuildIdentity(STOCKFISH_18_BUILD_IDENTITY)
  const artifact = STOCKFISH_18_ARTIFACT
  const identity = STOCKFISH_18_BUILD_IDENTITY
  const paths = resolveStockfishInstallPaths(workspaceRoot)

  if (await pathExists(paths.installDirectory)) {
    return validateInstalledTree(paths, artifact, identity)
  }

  await mkdir(dirname(paths.installDirectory), { recursive: true })
  const stagingDirectory = await mkdtemp(
    join(paths.storageDirectory, ".provision-"),
  )
  assertPathWithin(
    paths.storageDirectory,
    stagingDirectory,
    "Stockfish staging directory",
  )

  try {
    const archivePath = resolve(stagingDirectory, artifact.archiveFileName)
    const extractionDirectory = resolve(stagingDirectory, "extracted")
    const extractedPackageDirectory = resolve(
      extractionDirectory,
      artifact.archiveTopLevelDirectory,
    )
    assertPathWithin(stagingDirectory, archivePath, "Stockfish archive")
    assertPathWithin(
      stagingDirectory,
      extractionDirectory,
      "Stockfish extraction directory",
    )
    assertPathWithin(
      extractionDirectory,
      extractedPackageDirectory,
      "Stockfish extracted package",
    )

    await mkdir(extractionDirectory, { recursive: true })
    await downloadArchive(artifact.archiveUrl, archivePath)
    await assertFileDigest(
      archivePath,
      artifact.archiveSha256,
      "Stockfish archive",
    )

    const archiveEntries = await listArchiveEntries(archivePath)
    validateArchiveEntryPaths(archiveEntries, artifact.archiveTopLevelDirectory)
    await extractArchive(archivePath, extractionDirectory)

    const extractedExecutablePath = resolve(
      extractedPackageDirectory,
      artifact.executableRelativePath,
    )
    const extractedLicensePath = resolve(
      extractedPackageDirectory,
      artifact.licenseRelativePath,
    )
    const extractedSourceDirectory = resolve(
      extractedPackageDirectory,
      artifact.sourceDirectoryRelativePath,
    )
    assertPathWithin(
      extractedPackageDirectory,
      extractedExecutablePath,
      "Stockfish executable",
    )
    assertPathWithin(
      extractedPackageDirectory,
      extractedLicensePath,
      "Stockfish license",
    )
    assertPathWithin(
      extractedPackageDirectory,
      extractedSourceDirectory,
      "Stockfish source",
    )
    await assertFile(extractedExecutablePath, "Stockfish executable")
    await assertFile(extractedLicensePath, "Stockfish GPL license")
    await assertDirectory(extractedSourceDirectory, "Stockfish source")
    await assertFileDigest(
      extractedExecutablePath,
      artifact.executableSha256,
      "Stockfish executable",
    )

    await writeFile(
      resolve(extractedPackageDirectory, PROVISIONING_MARKER_FILE_NAME),
      `${JSON.stringify(createProvisioningMarker(artifact, identity), null, 2)}\n`,
      "utf8",
    )

    try {
      await rename(extractedPackageDirectory, paths.installDirectory)
    } catch (error) {
      if (!(await pathExists(paths.installDirectory))) throw error
    }

    return await validateInstalledTree(paths, artifact, identity)
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true })
  }
}

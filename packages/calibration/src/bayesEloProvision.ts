import { createHash } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import {
  BAYES_ELO_EXECUTABLE_IDENTITY,
  type BayesEloExecutableIdentity,
} from "./bayesEloIdentity.js"

export type BayesEloInstallPaths = Readonly<{
  executablePath: string
  installDirectory: string
  storageDirectory: string
}>

export type ProvisionedBayesElo = Readonly<{
  executablePath: string
  identity: BayesEloExecutableIdentity
}>

export type DownloadBayesEloExecutable = (url: string) => Promise<Uint8Array>

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
    await stat(path)
    return true
  } catch (error) {
    if (isMissingPath(error)) return false
    throw error
  }
}

function executableSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function verifyBayesEloExecutable(bytes: Uint8Array): void {
  const actualSha256 = executableSha256(bytes)

  if (actualSha256 !== BAYES_ELO_EXECUTABLE_IDENTITY.sha256) {
    throw new Error(
      `BayesElo executable SHA-256 mismatch: expected ${BAYES_ELO_EXECUTABLE_IDENTITY.sha256}, received ${actualSha256}.`,
    )
  }
}

export function validateBayesEloHost(
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform === "win32") return

  throw new TypeError(
    `BayesElo ${BAYES_ELO_EXECUTABLE_IDENTITY.version} provisioning does not support ${platform}.`,
  )
}

export function resolveBayesEloInstallPaths(
  workspaceRoot: string,
): BayesEloInstallPaths {
  const storageDirectory = resolve(workspaceRoot, ".bayeselo")
  const installDirectory = resolve(
    storageDirectory,
    BAYES_ELO_EXECUTABLE_IDENTITY.version,
  )
  const executablePath = resolve(
    installDirectory,
    BAYES_ELO_EXECUTABLE_IDENTITY.fileName,
  )

  return { storageDirectory, installDirectory, executablePath }
}

async function downloadBayesEloExecutable(url: string): Promise<Uint8Array> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `BayesElo executable download failed with HTTP ${response.status}.`,
    )
  }

  return new Uint8Array(await response.arrayBuffer())
}

async function validateInstalledBayesElo(
  executablePath: string,
): Promise<ProvisionedBayesElo> {
  const executableStat = await stat(executablePath)
  if (!executableStat.isFile()) {
    throw new Error(`BayesElo executable must be a file: ${executablePath}.`)
  }

  verifyBayesEloExecutable(await readFile(executablePath))
  return {
    executablePath,
    identity: BAYES_ELO_EXECUTABLE_IDENTITY,
  }
}

export default async function provisionBayesElo(
  workspaceRoot: string,
  downloadExecutable: DownloadBayesEloExecutable = downloadBayesEloExecutable,
): Promise<ProvisionedBayesElo> {
  validateBayesEloHost()
  const paths = resolveBayesEloInstallPaths(workspaceRoot)

  if (await pathExists(paths.executablePath)) {
    return validateInstalledBayesElo(paths.executablePath)
  }

  await mkdir(paths.installDirectory, { recursive: true })
  const stagingDirectory = await mkdtemp(
    join(paths.storageDirectory, ".provision-"),
  )

  try {
    const stagedExecutablePath = join(
      stagingDirectory,
      BAYES_ELO_EXECUTABLE_IDENTITY.fileName,
    )
    const executableBytes = await downloadExecutable(
      BAYES_ELO_EXECUTABLE_IDENTITY.downloadUrl,
    )
    verifyBayesEloExecutable(executableBytes)
    await writeFile(stagedExecutablePath, executableBytes)
    await mkdir(dirname(paths.executablePath), { recursive: true })

    try {
      await rename(stagedExecutablePath, paths.executablePath)
    } catch (error) {
      if (!(await pathExists(paths.executablePath))) throw error
    }

    return await validateInstalledBayesElo(paths.executablePath)
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true })
  }
}

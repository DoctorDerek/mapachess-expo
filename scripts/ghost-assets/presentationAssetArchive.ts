import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { loadEnvFile } from "node:process"
import { fileURLToPath } from "node:url"
import {
  ERR_INVALID_PASSWORD,
  ERR_INVALID_SIGNATURE,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js"

export const LICENSED_PRESENTATION_ASSET_KEY_VARIABLE =
  "GHOST_ASSET_KEY_MAPACHESS"

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "../..")
const ARCHIVE_ENTRY_DATE = new Date("2026-09-03T00:00:00.000Z")
const MINIMUM_ARCHIVE_CREATION_KEY_LENGTH = 32
const ASSET_FAILURE_MESSAGES = Object.freeze({
  manifest: "The licensed presentation asset manifest is invalid.",
  path: "An asset path resolves outside its destination.",
  integrity: "Licensed presentation assets failed integrity checks.",
  archive: "The licensed presentation archive is invalid.",
  incompleteArchive: "The licensed presentation archive is incomplete.",
  key: `${LICENSED_PRESENTATION_ASSET_KEY_VARIABLE} is required to encrypt or decrypt the presentation archive.`,
  creationKey: `The protected asset key must contain at least ${MINIMUM_ARCHIVE_CREATION_KEY_LENGTH} characters to create an archive.`,
  missingArchive: "The licensed presentation asset archive is required.",
})

const resolvePresentationAssetPaths = (repositoryRoot: string) => ({
  manifest: join(
    repositoryRoot,
    "ghost_assets/presentation-assets.manifest.json",
  ),
  archive: join(repositoryRoot, "ghost_assets/presentation-assets.zip"),
  localEnvironment: join(repositoryRoot, "apps/web/.env.local"),
  localSource: join(repositoryRoot, "vendor/presentation-assets"),
  archiveSource: join(repositoryRoot, "vendor/presentation-assets-archive"),
  vendor: join(repositoryRoot, "vendor"),
  publicAssets: join(
    repositoryRoot,
    "apps/web/public/generated/presentation-assets",
  ),
})

type PresentationAssetPaths = ReturnType<typeof resolvePresentationAssetPaths>

type LicensedPresentationAssetFile = Readonly<{
  path: string
  sha256: string
}>

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const describeLicensedPresentationAssetFailure = (
  error: unknown,
): string => {
  if (error instanceof Error) {
    const knownMessage = Object.values(ASSET_FAILURE_MESSAGES).find(
      (message) => message === error.message,
    )
    if (knownMessage) return knownMessage
    if (
      error.message === ERR_INVALID_PASSWORD ||
      error.message === ERR_INVALID_SIGNATURE
    )
      return `The presentation archive could not authenticate with ${LICENSED_PRESENTATION_ASSET_KEY_VARIABLE}. Verify that the password matches the one used to create this archive.`
  }

  if (isRecord(error)) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR")
      return "A required presentation asset file or directory is missing. Verify the manifest and source files needed for this operation."
    if (error.code === "EACCES" || error.code === "EPERM")
      return "Presentation asset files could not be accessed. Check filesystem permissions."
    if (error.code === "ENOSPC")
      return "Presentation asset processing ran out of filesystem space."
  }

  return "Licensed presentation asset processing failed with an unrecognized error; private error details were withheld."
}

const parseManifestFile = (value: unknown): LicensedPresentationAssetFile => {
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    !/^[a-z0-9_./-]+\.png$/.test(value.path) ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw new Error(ASSET_FAILURE_MESSAGES.manifest)

  return Object.freeze({ path: value.path, sha256: value.sha256 })
}

export const readLicensedPresentationAssetManifest = async (
  manifestPath: string = resolvePresentationAssetPaths(REPOSITORY_ROOT)
    .manifest,
): Promise<readonly LicensedPresentationAssetFile[]> => {
  const parsedManifest: unknown = JSON.parse(
    await readFile(manifestPath, "utf8"),
  )

  if (!isRecord(parsedManifest) || !Array.isArray(parsedManifest.files))
    throw new Error(ASSET_FAILURE_MESSAGES.manifest)

  const files = parsedManifest.files.map(parseManifestFile)
  const uniquePaths = new Set(files.map((file) => file.path))

  if (files.length === 0 || uniquePaths.size !== files.length)
    throw new Error(ASSET_FAILURE_MESSAGES.manifest)

  return Object.freeze(files)
}

const resolveContainedAssetPath = (
  rootDirectory: string,
  relativeAssetPath: string,
): string => {
  const resolvedRootDirectory = resolve(rootDirectory)
  const resolvedAssetPath = resolve(
    resolvedRootDirectory,
    ...relativeAssetPath.split("/"),
  )
  const relativeResolvedPath = relative(
    resolvedRootDirectory,
    resolvedAssetPath,
  )

  if (
    isAbsolute(relativeResolvedPath) ||
    relativeResolvedPath === ".." ||
    relativeResolvedPath.startsWith(`..${sep}`)
  )
    throw new Error(ASSET_FAILURE_MESSAGES.path)

  return resolvedAssetPath
}

const fileSha256 = async (filePath: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex")

const hasValidAssetFiles = async (
  sourceRoot: string,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<boolean> => {
  try {
    const validationResults = await Promise.all(
      manifest.map(async (file) => {
        const sourcePath = resolveContainedAssetPath(sourceRoot, file.path)
        return (await fileSha256(sourcePath)) === file.sha256
      }),
    )
    return validationResults.every(Boolean)
  } catch (error: unknown) {
    if (
      isRecord(error) &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    )
      return false
    throw error
  }
}

const assertValidAssetFiles = async (
  sourceRoot: string,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<void> => {
  if (!(await hasValidAssetFiles(sourceRoot, manifest)))
    throw new Error(ASSET_FAILURE_MESSAGES.integrity)
}

const extractEncryptedArchive = async (
  archivePath: string,
  destinationRoot: string,
  assetKey: string,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<void> => {
  const expectedPaths = new Set(manifest.map((file) => file.path))
  const extractedPaths = new Set<string>()
  const archiveData = await readFile(archivePath)
  const archiveReader = new ZipReader(new Uint8ArrayReader(archiveData), {
    checkAmbiguity: true,
    useWebWorkers: false,
  })

  try {
    for (const entry of await archiveReader.getEntries()) {
      const normalizedPath = entry.filename.replaceAll("\\", "/")

      if (
        entry.directory ||
        !entry.encrypted ||
        entry.zipCrypto ||
        entry.extraFieldAES?.strength !== 3 ||
        entry.extraFieldAES?.vendorVersion !== 2 ||
        normalizedPath !== entry.filename ||
        !expectedPaths.has(normalizedPath) ||
        extractedPaths.has(normalizedPath)
      )
        throw new Error(ASSET_FAILURE_MESSAGES.archive)

      const entryData = await entry.getData(new Uint8ArrayWriter(), {
        checkAmbiguity: true,
        password: assetKey,
        useWebWorkers: false,
      })

      if (entryData === undefined)
        throw new Error(ASSET_FAILURE_MESSAGES.archive)

      const destinationPath = resolveContainedAssetPath(
        destinationRoot,
        normalizedPath,
      )
      await mkdir(dirname(destinationPath), { recursive: true })
      await writeFile(destinationPath, entryData)
      extractedPaths.add(normalizedPath)
    }
  } finally {
    await archiveReader.close()
  }

  if (extractedPaths.size !== expectedPaths.size)
    throw new Error(ASSET_FAILURE_MESSAGES.incompleteArchive)

  await assertValidAssetFiles(destinationRoot, manifest)
}

const loadLocalEnvironment = (environmentPath: string): void => {
  if (existsSync(environmentPath)) loadEnvFile(environmentPath)
}

const requireAssetKey = (): string => {
  const assetKey = process.env[LICENSED_PRESENTATION_ASSET_KEY_VARIABLE]
  if (!assetKey) throw new Error(ASSET_FAILURE_MESSAGES.key)
  return assetKey
}

const prepareArchiveSource = async (
  paths: PresentationAssetPaths,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<string> => {
  if (!existsSync(paths.archive))
    throw new Error(ASSET_FAILURE_MESSAGES.missingArchive)

  const temporaryExtractionRoot = join(
    paths.vendor,
    `.presentation-assets-${process.pid}`,
  )
  await mkdir(paths.vendor, { recursive: true })
  await rm(temporaryExtractionRoot, { force: true, recursive: true })

  try {
    await extractEncryptedArchive(
      paths.archive,
      temporaryExtractionRoot,
      requireAssetKey(),
      manifest,
    )
    await rm(paths.archiveSource, { force: true, recursive: true })
    await rename(temporaryExtractionRoot, paths.archiveSource)
  } finally {
    await rm(temporaryExtractionRoot, { force: true, recursive: true })
  }

  return paths.archiveSource
}

const publishAssetFiles = async (
  sourceRoot: string,
  publicAssetRoot: string,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<void> => {
  await rm(publicAssetRoot, { force: true, recursive: true })

  for (const file of manifest) {
    const sourcePath = resolveContainedAssetPath(sourceRoot, file.path)
    const publicPath = resolveContainedAssetPath(publicAssetRoot, file.path)
    await mkdir(dirname(publicPath), { recursive: true })
    await copyFile(sourcePath, publicPath)
  }
}

export const prepareLicensedPresentationAssets = async (
  repositoryRoot: string = REPOSITORY_ROOT,
): Promise<void> => {
  const paths = resolvePresentationAssetPaths(repositoryRoot)
  loadLocalEnvironment(paths.localEnvironment)

  try {
    const manifest = await readLicensedPresentationAssetManifest(paths.manifest)
    const hasLocalAssets = await hasValidAssetFiles(paths.localSource, manifest)

    if (
      !hasLocalAssets &&
      process.env[LICENSED_PRESENTATION_ASSET_KEY_VARIABLE] === undefined
    ) {
      await rm(paths.publicAssets, { force: true, recursive: true })
      return
    }

    const sourceRoot = hasLocalAssets
      ? paths.localSource
      : await prepareArchiveSource(paths, manifest)
    await publishAssetFiles(sourceRoot, paths.publicAssets, manifest)
  } finally {
    await rm(paths.archiveSource, { force: true, recursive: true })
  }
}

export const hasPublishedLicensedPresentationAssets = async (
  repositoryRoot: string = REPOSITORY_ROOT,
): Promise<boolean> => {
  const paths = resolvePresentationAssetPaths(repositoryRoot)
  const manifest = await readLicensedPresentationAssetManifest(paths.manifest)
  return hasValidAssetFiles(paths.publicAssets, manifest)
}

export const createLicensedPresentationAssetArchive = async (
  repositoryRoot: string = REPOSITORY_ROOT,
): Promise<void> => {
  const paths = resolvePresentationAssetPaths(repositoryRoot)
  loadLocalEnvironment(paths.localEnvironment)
  const assetKey = requireAssetKey()
  if (assetKey.length < MINIMUM_ARCHIVE_CREATION_KEY_LENGTH)
    throw new Error(ASSET_FAILURE_MESSAGES.creationKey)
  const manifest = await readLicensedPresentationAssetManifest(paths.manifest)
  await assertValidAssetFiles(paths.localSource, manifest)

  const archiveWriter = new ZipWriter(new Uint8ArrayWriter(), {
    encryptionStrength: 3,
    password: assetKey,
    useWebWorkers: false,
    zipCrypto: false,
  })

  for (const file of manifest) {
    const sourcePath = resolveContainedAssetPath(paths.localSource, file.path)
    await archiveWriter.add(
      file.path,
      new Uint8ArrayReader(await readFile(sourcePath)),
      {
        extendedTimestamp: false,
        lastModDate: ARCHIVE_ENTRY_DATE,
      },
    )
  }

  await mkdir(dirname(paths.archive), { recursive: true })
  await writeFile(paths.archive, await archiveWriter.close())
}

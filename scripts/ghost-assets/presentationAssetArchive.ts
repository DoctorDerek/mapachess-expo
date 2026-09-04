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
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js"

export const LICENSED_PRESENTATION_ASSET_MODE_VARIABLE =
  "NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS"
export const LICENSED_PRESENTATION_ASSET_KEY_VARIABLE =
  "GHOST_ASSET_KEY_MAPACHESS"

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "../..")
const MANIFEST_PATH = join(
  REPOSITORY_ROOT,
  "ghost_assets/presentation-assets.manifest.json",
)
const ARCHIVE_PATH = join(
  REPOSITORY_ROOT,
  "ghost_assets/presentation-assets.zip",
)
const LOCAL_ENVIRONMENT_PATH = join(REPOSITORY_ROOT, "apps/web/.env.local")
const LOCAL_SOURCE_ROOT = join(REPOSITORY_ROOT, "vendor/presentation-assets")
const ARCHIVE_SOURCE_ROOT = join(
  REPOSITORY_ROOT,
  "vendor/presentation-assets-archive",
)
const VENDOR_ROOT = join(REPOSITORY_ROOT, "vendor")
const PUBLIC_ASSET_ROOT = join(
  REPOSITORY_ROOT,
  "apps/web/public/generated/presentation-assets",
)
const ARCHIVE_ENTRY_DATE = new Date("2026-09-03T00:00:00.000Z")

type LicensedPresentationAssetFile = Readonly<{
  path: string
  sha256: string
}>

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const parseManifestFile = (value: unknown): LicensedPresentationAssetFile => {
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    !/^[a-z0-9_./-]+\.png$/.test(value.path) ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw new Error("The licensed presentation asset manifest is invalid.")

  return Object.freeze({ path: value.path, sha256: value.sha256 })
}

export const readLicensedPresentationAssetManifest = async (): Promise<
  readonly LicensedPresentationAssetFile[]
> => {
  const parsedManifest: unknown = JSON.parse(
    await readFile(MANIFEST_PATH, "utf8"),
  )

  if (!isRecord(parsedManifest) || !Array.isArray(parsedManifest.files))
    throw new Error("The licensed presentation asset manifest is invalid.")

  const files = parsedManifest.files.map(parseManifestFile)
  const uniquePaths = new Set(files.map((file) => file.path))

  if (files.length === 0 || uniquePaths.size !== files.length)
    throw new Error("The licensed presentation asset manifest is invalid.")

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
    throw new Error("An asset path resolves outside its destination.")

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
    throw new Error("Licensed presentation assets failed integrity checks.")
}

const extractEncryptedArchive = async (
  destinationRoot: string,
  assetKey: string,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<void> => {
  const expectedPaths = new Set(manifest.map((file) => file.path))
  const extractedPaths = new Set<string>()
  const archiveData = await readFile(ARCHIVE_PATH)
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
        throw new Error("The licensed presentation archive is invalid.")

      const entryData = await entry.getData(new Uint8ArrayWriter(), {
        checkAmbiguity: true,
        password: assetKey,
        useWebWorkers: false,
      })

      if (entryData === undefined)
        throw new Error("The licensed presentation archive is invalid.")

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
    throw new Error("The licensed presentation archive is incomplete.")

  await assertValidAssetFiles(destinationRoot, manifest)
}

const loadLocalEnvironment = (): void => {
  if (existsSync(LOCAL_ENVIRONMENT_PATH)) loadEnvFile(LOCAL_ENVIRONMENT_PATH)
}

const requireAssetKey = (): string => {
  const assetKey = process.env[LICENSED_PRESENTATION_ASSET_KEY_VARIABLE]
  if (assetKey === undefined || !/^[A-Za-z0-9_-]{43}$/.test(assetKey))
    throw new Error("The licensed presentation asset key is required.")
  return assetKey
}

const prepareArchiveSource = async (
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<string> => {
  if (await hasValidAssetFiles(LOCAL_SOURCE_ROOT, manifest))
    return LOCAL_SOURCE_ROOT

  if (!existsSync(ARCHIVE_PATH))
    throw new Error("The licensed presentation asset archive is required.")

  const temporaryExtractionRoot = join(
    VENDOR_ROOT,
    `.presentation-assets-${process.pid}`,
  )
  await mkdir(VENDOR_ROOT, { recursive: true })
  await rm(temporaryExtractionRoot, { force: true, recursive: true })

  try {
    await extractEncryptedArchive(
      temporaryExtractionRoot,
      requireAssetKey(),
      manifest,
    )
    await rm(ARCHIVE_SOURCE_ROOT, { force: true, recursive: true })
    await rename(temporaryExtractionRoot, ARCHIVE_SOURCE_ROOT)
  } finally {
    await rm(temporaryExtractionRoot, { force: true, recursive: true })
  }

  return ARCHIVE_SOURCE_ROOT
}

const publishAssetFiles = async (
  sourceRoot: string,
  manifest: readonly LicensedPresentationAssetFile[],
): Promise<void> => {
  await rm(PUBLIC_ASSET_ROOT, { force: true, recursive: true })

  for (const file of manifest) {
    const sourcePath = resolveContainedAssetPath(sourceRoot, file.path)
    const publicPath = resolveContainedAssetPath(PUBLIC_ASSET_ROOT, file.path)
    await mkdir(dirname(publicPath), { recursive: true })
    await copyFile(sourcePath, publicPath)
  }
}

export const prepareLicensedPresentationAssets = async (): Promise<void> => {
  loadLocalEnvironment()
  const assetMode =
    process.env[LICENSED_PRESENTATION_ASSET_MODE_VARIABLE] ?? "fallback"

  if (assetMode !== "fallback" && assetMode !== "licensed")
    throw new Error("The licensed presentation asset mode is invalid.")

  if (assetMode === "fallback") {
    await rm(PUBLIC_ASSET_ROOT, { force: true, recursive: true })
    return
  }

  const manifest = await readLicensedPresentationAssetManifest()
  const sourceRoot = await prepareArchiveSource(manifest)
  await assertValidAssetFiles(sourceRoot, manifest)
  await publishAssetFiles(sourceRoot, manifest)
}

export const createLicensedPresentationAssetArchive =
  async (): Promise<void> => {
    loadLocalEnvironment()
    const assetKey = requireAssetKey()
    const manifest = await readLicensedPresentationAssetManifest()
    await assertValidAssetFiles(LOCAL_SOURCE_ROOT, manifest)

    const archiveWriter = new ZipWriter(new Uint8ArrayWriter(), {
      encryptionStrength: 3,
      password: assetKey,
      useWebWorkers: false,
      zipCrypto: false,
    })

    for (const file of manifest) {
      const sourcePath = resolveContainedAssetPath(LOCAL_SOURCE_ROOT, file.path)
      await archiveWriter.add(
        file.path,
        new Uint8ArrayReader(await readFile(sourcePath)),
        {
          extendedTimestamp: false,
          lastModDate: ARCHIVE_ENTRY_DATE,
        },
      )
    }

    await mkdir(dirname(ARCHIVE_PATH), { recursive: true })
    await writeFile(ARCHIVE_PATH, await archiveWriter.close())
  }

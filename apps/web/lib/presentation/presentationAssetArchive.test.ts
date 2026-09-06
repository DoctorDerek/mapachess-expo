import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createLicensedPresentationAssetArchive,
  describeLicensedPresentationAssetFailure,
  hasPublishedLicensedPresentationAssets,
  LICENSED_PRESENTATION_ASSET_KEY_VARIABLE,
  prepareLicensedPresentationAssets,
} from "../../../../scripts/ghost-assets/presentationAssetArchive"

const FIXTURE_KEY = "A".repeat(43)
const FIXTURE_PATH = "coach/fixture.png"
const FIXTURE_BYTES = Buffer.from("noncommercial asset integrity fixture")
const FIXTURE_DIGEST = createHash("sha256").update(FIXTURE_BYTES).digest("hex")
const executeFile = promisify(execFile)

describe("licensed presentation asset preparation", () => {
  let repositoryRoot: string
  let localSource: string
  let archivePath: string
  let manifestPath: string
  let publicAssets: string
  let archiveSource: string

  beforeEach(async () => {
    repositoryRoot = await mkdtemp(join(tmpdir(), "mapachess-assets-"))
    localSource = join(repositoryRoot, "vendor/presentation-assets")
    archivePath = join(repositoryRoot, "ghost_assets/presentation-assets.zip")
    manifestPath = join(
      repositoryRoot,
      "ghost_assets/presentation-assets.manifest.json",
    )
    publicAssets = join(
      repositoryRoot,
      "apps/web/public/generated/presentation-assets",
    )
    archiveSource = join(repositoryRoot, "vendor/presentation-assets-archive")
    vi.stubEnv(LICENSED_PRESENTATION_ASSET_KEY_VARIABLE, FIXTURE_KEY)
    await mkdir(dirname(manifestPath), { recursive: true })
    await writeManifest(FIXTURE_PATH, FIXTURE_DIGEST)
    await mkdir(dirname(join(localSource, FIXTURE_PATH)), { recursive: true })
    await writeFile(join(localSource, FIXTURE_PATH), FIXTURE_BYTES)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(repositoryRoot, { recursive: true, force: true })
  })

  const writeManifest = async (path: string, sha256: string): Promise<void> => {
    await writeFile(manifestPath, JSON.stringify({ files: [{ path, sha256 }] }))
  }

  const useArchiveOnly = async (): Promise<void> => {
    await createLicensedPresentationAssetArchive(repositoryRoot)
    await rm(localSource, { recursive: true })
  }

  const expectExtractionCleaned = async (): Promise<void> => {
    expect(existsSync(archiveSource)).toBe(false)
    expect(
      (await readdir(join(repositoryRoot, "vendor"))).filter((name) =>
        name.startsWith(".presentation-assets-"),
      ),
    ).toEqual([])
  }

  const runDeploymentLauncher = async (key: string) => {
    for (const path of [
      "package.json",
      "tsconfig.json",
      "scripts/decrypt-assets.ts",
      "scripts/ghost-assets/presentationAssetArchive.ts",
    ]) {
      const destination = join(repositoryRoot, path)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(
        new URL(`../../../../${path}`, import.meta.url),
        destination,
      )
    }
    await symlink(
      fileURLToPath(new URL("../../../../node_modules", import.meta.url)),
      join(repositoryRoot, "node_modules"),
      "junction",
    )
    const workingDirectory = join(repositoryRoot, "apps/web")
    await mkdir(workingDirectory, { recursive: true })
    return executeFile(
      process.execPath,
      ["--import", "jiti/register", "../../scripts/decrypt-assets.ts"],
      {
        cwd: workingDirectory,
        windowsHide: true,
        timeout: 10_000,
        env: {
          ...process.env,
          [LICENSED_PRESENTATION_ASSET_KEY_VARIABLE]: key,
        },
      },
    )
  }

  it.each([false, true])(
    "clears stale published assets without a key or complete local files (partial source: %s)",
    async (partialSource) => {
      vi.stubEnv(LICENSED_PRESENTATION_ASSET_KEY_VARIABLE, undefined)
      await rm(localSource, { recursive: true })
      if (partialSource) {
        await mkdir(localSource, { recursive: true })
        await writeFile(join(localSource, "unrelated.png"), FIXTURE_BYTES)
      }
      await mkdir(publicAssets, { recursive: true })
      await writeFile(join(publicAssets, "old.png"), FIXTURE_BYTES)
      await mkdir(archiveSource, { recursive: true })

      await prepareLicensedPresentationAssets(repositoryRoot)

      expect(existsSync(publicAssets)).toBe(false)
      expect(await hasPublishedLicensedPresentationAssets(repositoryRoot)).toBe(
        false,
      )
      expect(existsSync(join(localSource, "unrelated.png"))).toBe(partialSource)
      await expectExtractionCleaned()
    },
  )

  it("publishes verified authoring files without requiring an archive or key", async () => {
    vi.stubEnv(LICENSED_PRESENTATION_ASSET_KEY_VARIABLE, undefined)
    await mkdir(archiveSource, { recursive: true })

    await prepareLicensedPresentationAssets(repositoryRoot)

    expect(await readFile(join(publicAssets, FIXTURE_PATH))).toEqual(
      FIXTURE_BYTES,
    )
    expect(await readFile(join(localSource, FIXTURE_PATH))).toEqual(
      FIXTURE_BYTES,
    )
    expect(existsSync(archivePath)).toBe(false)
    await expectExtractionCleaned()
  })

  it("decrypts and publishes the allowlisted archive without retaining staging", async () => {
    await useArchiveOnly()

    await prepareLicensedPresentationAssets(repositoryRoot)

    expect(await readFile(join(publicAssets, FIXTURE_PATH))).toEqual(
      FIXTURE_BYTES,
    )
    expect(existsSync(archivePath)).toBe(true)
    expect(existsSync(localSource)).toBe(false)
    await expectExtractionCleaned()
  })

  it("publishes through the deployment launcher without local authoring or environment files", async () => {
    await useArchiveOnly()

    const result = await runDeploymentLauncher(FIXTURE_KEY)

    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("")
    expect(await readFile(join(publicAssets, FIXTURE_PATH))).toEqual(
      FIXTURE_BYTES,
    )
    expect(existsSync(localSource)).toBe(false)
    expect(existsSync(join(repositoryRoot, "apps/web/.env.local"))).toBe(false)
    await expectExtractionCleaned()
  })

  it.each([
    {
      key: "invalid-private-fixture",
      reason: "existing 43-character archive key",
    },
    { key: "B".repeat(43), reason: "could not authenticate" },
  ])(
    "reports a safe actionable CLI failure for $reason",
    async ({ key, reason }) => {
      await useArchiveOnly()

      await expect(runDeploymentLauncher(key)).rejects.toMatchObject({
        code: 1,
        stdout: "",
        stderr: expect.stringContaining(reason),
      })
      expect(existsSync(publicAssets)).toBe(false)
      await expectExtractionCleaned()
    },
  )

  it("withholds arbitrary errors, private paths, and nested causes from build logs", () => {
    const privateDetail = "private-diagnostic-fixture"
    for (const error of [
      new Error(privateDetail),
      new Error("Invalid password", { cause: new Error(privateDetail) }),
      { code: "ENOENT", path: privateDetail, message: privateDetail },
      { code: "EACCES", path: privateDetail, message: privateDetail },
      { code: "ENOSPC", path: privateDetail, message: privateDetail },
      { code: privateDetail, message: privateDetail },
    ]) {
      expect(describeLicensedPresentationAssetFailure(error)).not.toContain(
        privateDetail,
      )
    }
  })

  it.each(["", "invalid", "B".repeat(43)])(
    "rejects an unusable required archive key (%s)",
    async (key) => {
      await useArchiveOnly()
      vi.stubEnv(LICENSED_PRESENTATION_ASSET_KEY_VARIABLE, key)

      await expect(
        prepareLicensedPresentationAssets(repositoryRoot),
      ).rejects.toThrow()

      expect(existsSync(publicAssets)).toBe(false)
      await expectExtractionCleaned()
    },
  )

  it("loads authorized local environment inputs from the selected root", async () => {
    await useArchiveOnly()
    vi.stubEnv(LICENSED_PRESENTATION_ASSET_KEY_VARIABLE, undefined)
    const environmentPath = join(repositoryRoot, "apps/web/.env.local")
    await mkdir(dirname(environmentPath), { recursive: true })
    await writeFile(
      environmentPath,
      `${LICENSED_PRESENTATION_ASSET_KEY_VARIABLE}=${FIXTURE_KEY}\n`,
    )

    await prepareLicensedPresentationAssets(repositoryRoot)

    expect(await readFile(join(publicAssets, FIXTURE_PATH))).toEqual(
      FIXTURE_BYTES,
    )
    await expectExtractionCleaned()
  })

  it("rejects a missing archive when no verified authoring source exists", async () => {
    await rm(localSource, { recursive: true })

    await expect(
      prepareLicensedPresentationAssets(repositoryRoot),
    ).rejects.toThrow("The licensed presentation asset archive is required.")
    await expectExtractionCleaned()
  })

  it("rejects decrypted content that does not match the manifest", async () => {
    await useArchiveOnly()
    await writeManifest(FIXTURE_PATH, "0".repeat(64))

    await expect(
      prepareLicensedPresentationAssets(repositoryRoot),
    ).rejects.toThrow("Licensed presentation assets failed integrity checks.")
    expect(existsSync(publicAssets)).toBe(false)
    await expectExtractionCleaned()
  })

  it("rejects archive entries outside the manifest allowlist", async () => {
    await useArchiveOnly()
    await writeManifest("coach/different.png", FIXTURE_DIGEST)

    await expect(
      prepareLicensedPresentationAssets(repositoryRoot),
    ).rejects.toThrow("The licensed presentation archive is invalid.")
    await expectExtractionCleaned()
  })

  it("rejects a manifest path that escapes its source root", async () => {
    await writeManifest("../escaped.png", FIXTURE_DIGEST)

    await expect(
      prepareLicensedPresentationAssets(repositoryRoot),
    ).rejects.toThrow("An asset path resolves outside its destination.")
    expect(existsSync(join(repositoryRoot, "vendor/escaped.png"))).toBe(false)
    await expectExtractionCleaned()
  })

  it("cleans extracted plaintext when publication cannot create its destination", async () => {
    await useArchiveOnly()
    const blockedParent = dirname(publicAssets)
    await mkdir(dirname(blockedParent), { recursive: true })
    await writeFile(blockedParent, "destination is a file")

    await expect(
      prepareLicensedPresentationAssets(repositoryRoot),
    ).rejects.toThrow()

    expect(await readFile(blockedParent, "utf8")).toBe("destination is a file")
    await expectExtractionCleaned()
  })

  it("derives renderer availability from the integrity of published files", async () => {
    expect(await hasPublishedLicensedPresentationAssets(repositoryRoot)).toBe(
      false,
    )
    await prepareLicensedPresentationAssets(repositoryRoot)
    expect(await hasPublishedLicensedPresentationAssets(repositoryRoot)).toBe(
      true,
    )
    await writeFile(join(publicAssets, FIXTURE_PATH), "damaged output")
    expect(await hasPublishedLicensedPresentationAssets(repositoryRoot)).toBe(
      false,
    )
  })

  it("repairs an incomplete local source from the keyed archive", async () => {
    await createLicensedPresentationAssetArchive(repositoryRoot)
    await writeFile(join(localSource, FIXTURE_PATH), "damaged local source")
    await prepareLicensedPresentationAssets(repositoryRoot)
    expect(await readFile(join(publicAssets, FIXTURE_PATH))).toEqual(
      FIXTURE_BYTES,
    )
    expect(await readFile(join(localSource, FIXTURE_PATH), "utf8")).toBe(
      "damaged local source",
    )
    await expectExtractionCleaned()
  })
})

import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"
import {
  STOCKFISH_18_ARTIFACT,
  STOCKFISH_18_BUILD_IDENTITY,
} from "./buildIdentity"
import provisionStockfish18, {
  resolveStockfishInstallPaths,
  validateArchiveEntryPaths,
} from "./provision"

const artifact = vi.hoisted(() => ({ archiveSha256: "", executableSha256: "" }))
vi.mock("./buildIdentity.js", async (original) => {
  const identity = await original<typeof import("./buildIdentity")>()
  return {
    ...identity,
    validateStockfish18Host: vi.fn(),
    get STOCKFISH_18_ARTIFACT() {
      return {
        ...identity.STOCKFISH_18_ARTIFACT,
        archiveSha256: artifact.archiveSha256,
        executableSha256: artifact.executableSha256,
      }
    },
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const execute = promisify(execFile)
const executable = Buffer.from("Owned test executable bytes; never executed.")
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex")

async function archiveFixture(
  onTestFinished: (cleanup: () => Promise<void>) => void,
  root = "stockfish",
) {
  const workspace = await mkdtemp(join(tmpdir(), "mapachess-provision-test-"))
  onTestFinished(() => rm(workspace, { recursive: true, force: true }))
  const source = join(workspace, "fixture-source")
  const tree = join(source, root)
  await mkdir(join(tree, "src"), { recursive: true })
  await writeFile(join(tree, "src", "main.cpp"), "Owned test source fixture")
  await writeFile(join(tree, "Copying.txt"), "Owned test license fixture")
  await writeFile(join(tree, "stockfish-windows-x86-64.exe"), executable)
  const archive = join(workspace, "fixture.tar")
  await execute("tar", ["-cf", archive, "-C", source, root])
  const bytes = await readFile(archive)
  artifact.archiveSha256 = digest(bytes)
  artifact.executableSha256 = digest(executable)
  const fetchArchive = vi.fn(async () => new Response(bytes))
  vi.stubGlobal("fetch", fetchArchive)
  return {
    workspace,
    fetchArchive,
    bytes,
    paths: resolveStockfishInstallPaths(workspace),
  }
}

describe("verified Stockfish installation transactions", () => {
  it("downloads, hashes, extracts, pins provenance, and reuses a complete local installation", async ({
    onTestFinished,
  }) => {
    const fixture = await archiveFixture(onTestFinished)
    const installed = await provisionStockfish18(fixture.workspace)
    expect(installed.executablePath).toBe(fixture.paths.executablePath)
    expect(await readFile(installed.executablePath)).toEqual(executable)
    expect(installed.identity).toEqual(STOCKFISH_18_BUILD_IDENTITY)
    expect(
      JSON.parse(await readFile(fixture.paths.markerPath, "utf8")),
    ).toEqual({
      schemaVersion: 1,
      artifact: STOCKFISH_18_ARTIFACT,
      identity: STOCKFISH_18_BUILD_IDENTITY,
    })
    expect(await readdir(fixture.paths.storageDirectory)).toEqual(["sf_18"])
    expect(await provisionStockfish18(fixture.workspace)).toEqual(installed)
    expect(fixture.fetchArchive).toHaveBeenCalledOnce()
  })

  it.each([401, 500])(
    "does not install HTTP %s and removes its staging directory",
    async (status) => {
      const fixture = await archiveFixture(onTestFinished)
      fixture.fetchArchive.mockResolvedValueOnce(new Response(null, { status }))
      await expect(provisionStockfish18(fixture.workspace)).rejects.toThrow(
        `HTTP ${status}`,
      )
      await expect(
        access(fixture.paths.installDirectory),
      ).rejects.toMatchObject({ code: "ENOENT" })
      expect(await readdir(fixture.paths.storageDirectory)).toEqual(["sf_18"])
    },
  )

  it("rejects altered archive bytes before extraction", async ({
    onTestFinished,
  }) => {
    const fixture = await archiveFixture(onTestFinished)
    fixture.fetchArchive.mockResolvedValueOnce(new Response("corrupt download"))
    await expect(provisionStockfish18(fixture.workspace)).rejects.toThrow(
      "Stockfish archive SHA-256 mismatch",
    )
    await expect(access(fixture.paths.installDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    })
    expect(await readdir(fixture.paths.storageDirectory)).toEqual(["sf_18"])
  })

  it("rejects an executable whose digest does not match its pin", async ({
    onTestFinished,
  }) => {
    const fixture = await archiveFixture(onTestFinished)
    artifact.executableSha256 = "0".repeat(64)
    await expect(provisionStockfish18(fixture.workspace)).rejects.toThrow(
      "Stockfish executable SHA-256 mismatch",
    )
    await expect(access(fixture.paths.installDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    })
  })

  it("rejects an unexpected archive root before writing an installation", async ({
    onTestFinished,
  }) => {
    const fixture = await archiveFixture(onTestFinished, "outside")
    await expect(provisionStockfish18(fixture.workspace)).rejects.toThrow(
      "must stay under stockfish/",
    )
    await expect(access(fixture.paths.installDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    })
  })

  it.each(["marker", "executable", "source", "license"] as const)(
    "refuses an invalid existing %s without fetching a silent replacement",
    async (part) => {
      const fixture = await archiveFixture(onTestFinished)
      await provisionStockfish18(fixture.workspace)
      const path =
        part === "marker"
          ? fixture.paths.markerPath
          : part === "executable"
            ? fixture.paths.executablePath
            : join(
                fixture.paths.installDirectory,
                part === "source" ? "src" : "Copying.txt",
              )
      if (part === "source" || part === "license") {
        await rm(path, { recursive: true })
        if (part === "source") await writeFile(path, "not a directory")
        else await mkdir(path)
      } else
        await writeFile(path, part === "marker" ? "{}" : "tampered executable")
      await expect(provisionStockfish18(fixture.workspace)).rejects.toThrow(
        part === "marker"
          ? "marker does not match"
          : part === "executable"
            ? "SHA-256 mismatch"
            : part === "source"
              ? "must be a directory"
              : "must be a file",
      )
      expect(fixture.fetchArchive).toHaveBeenCalledOnce()
    },
  )

  it.each(
    [
      [],
      [""],
      ["/absolute"],
      ["C:\\outside"],
      ["stockfish/../outside"],
      ["stockfish/invalid\0file"],
    ].map((entries) => ({ entries })),
  )("rejects unsafe archive entries $entries", ({ entries }) => {
    expect(() => validateArchiveEntryPaths(entries, "stockfish")).toThrow()
  })
})

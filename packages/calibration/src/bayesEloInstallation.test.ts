import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"
import provisionBayesElo, {
  resolveBayesEloInstallPaths,
} from "./bayesEloProvision"

vi.mock("./bayesEloIdentity.js", async (original) => ({
  ...(await original<typeof import("./bayesEloIdentity")>()),
  BAYES_ELO_EXECUTABLE_IDENTITY: {
    name: "bayeselo",
    version: "0056",
    fileName: "bayeselo.exe",
    downloadUrl: "https://example.invalid/owned-fixture",
    sha256: createHash("sha256")
      .update("Owned BayesElo test bytes")
      .digest("hex"),
  },
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function workspaceFixture() {
  const workspace = await mkdtemp(
    join(tmpdir(), "mapachess-bayeselo-installation-"),
  )
  onTestFinished(() => rm(workspace, { recursive: true, force: true }))
  return { workspace, paths: resolveBayesEloInstallPaths(workspace) }
}

describe("BayesElo verified installation transactions", () => {
  it("downloads and pins test bytes, removes staging, and reuses the exact verified executable", async () => {
    const fixture = await workspaceFixture()
    const fetchExecutable = vi.fn(
      async () => new Response("Owned BayesElo test bytes"),
    )
    vi.stubGlobal("fetch", fetchExecutable)
    const first = await provisionBayesElo(fixture.workspace, undefined, "win32")
    expect(await readFile(first.executablePath, "utf8")).toBe(
      "Owned BayesElo test bytes",
    )
    expect(
      await provisionBayesElo(fixture.workspace, undefined, "win32"),
    ).toEqual(first)
    expect(fetchExecutable).toHaveBeenCalledOnce()
    expect(await readdir(fixture.paths.storageDirectory)).toEqual(["0056"])
  })

  it("rejects failed downloads and removes staging without leaving a runnable file", async () => {
    const fixture = await workspaceFixture()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    )
    await expect(
      provisionBayesElo(fixture.workspace, undefined, "win32"),
    ).rejects.toThrow("HTTP 503")
    expect(await readdir(fixture.paths.storageDirectory)).toEqual(["0056"])
    expect(await readdir(fixture.paths.installDirectory)).toEqual([])
  })

  it("rejects an executable path that is actually a directory without requesting replacement bytes", async () => {
    const fixture = await workspaceFixture()
    await mkdir(fixture.paths.executablePath, { recursive: true })
    const download = vi.fn(async () => Buffer.from("Owned BayesElo test bytes"))
    await expect(
      provisionBayesElo(fixture.workspace, download, "win32"),
    ).rejects.toThrow("must be a file")
    expect(download).not.toHaveBeenCalled()
  })
})

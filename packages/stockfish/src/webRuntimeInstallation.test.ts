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
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"
import {
  STOCKFISH_18_WEB_RUNTIME_ARTIFACTS,
  type StockfishWebRuntimeArtifact,
} from "./webRuntimeIdentity"
import provisionStockfishWebRuntime, {
  resolveStockfishWebRuntimeDirectory,
} from "./webRuntimeProvision"

vi.mock("./webRuntimeIdentity.js", async (original) => {
  const actual = await original<typeof import("./webRuntimeIdentity")>()
  const { parseSha256Hex } = await import("./buildIdentity")
  const artifact = (source: StockfishWebRuntimeArtifact, value: string) => ({
    ...source,
    byteLength: Buffer.byteLength(value),
    sha256: parseSha256Hex(createHash("sha256").update(value).digest("hex")),
  })
  const loader = artifact(
    actual.STOCKFISH_18_WEB_LOADER_ARTIFACT,
    "Owned test loader",
  )
  const wasm = artifact(
    actual.STOCKFISH_18_WEB_WASM_ARTIFACT,
    "Owned test WASM",
  )
  const artifacts = [loader, wasm]
  return {
    ...actual,
    STOCKFISH_18_WEB_LOADER_ARTIFACT: loader,
    STOCKFISH_18_WEB_WASM_ARTIFACT: wasm,
    STOCKFISH_18_WEB_RUNTIME_ARTIFACTS: artifacts,
    STOCKFISH_18_WEB_RUNTIME_IDENTITY: {
      ...actual.STOCKFISH_18_WEB_RUNTIME_IDENTITY,
      artifacts,
    },
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function installationFixture() {
  const workspace = await mkdtemp(
    join(tmpdir(), "mapachess-web-runtime-installation-"),
  )
  onTestFinished(() => rm(workspace, { recursive: true, force: true }))
  const fetchRuntime = vi.fn<typeof fetch>(
    async (input) =>
      new Response(
        String(input).endsWith(".wasm")
          ? "Owned test WASM"
          : "Owned test loader",
      ),
  )
  return {
    workspace,
    fetchRuntime,
    directory: resolveStockfishWebRuntimeDirectory(workspace),
  }
}

describe("web runtime installation and existing-file recovery", () => {
  it("promotes a fully verified pair atomically and reuses it without another network request", async () => {
    const fixture = await installationFixture()
    const first = await provisionStockfishWebRuntime(fixture.workspace, {
      fetchImplementation: fixture.fetchRuntime,
    })
    expect(await readFile(first.loaderPath, "utf8")).toBe("Owned test loader")
    expect(await readFile(first.wasmPath, "utf8")).toBe("Owned test WASM")
    expect(first.downloadRecoveries).toEqual([])
    expect(fixture.fetchRuntime).toHaveBeenCalledTimes(2)
    expect(
      await provisionStockfishWebRuntime(fixture.workspace, {
        fetchImplementation: fixture.fetchRuntime,
      }),
    ).toEqual(first)
    expect(fixture.fetchRuntime).toHaveBeenCalledTimes(2)
    expect(await readdir(join(fixture.workspace, "apps/web/public"))).toEqual([
      "stockfish-runtime",
    ])
  })

  it("retains the verified mirror recovery diagnostic alongside the installed runtime", async () => {
    const fixture = await installationFixture()
    fixture.fetchRuntime.mockImplementation(async (input) =>
      String(input).startsWith("https://github.com/")
        ? new Response(null, { status: 404 })
        : new Response(
            String(input).endsWith(".wasm")
              ? "Owned test WASM"
              : "Owned test loader",
          ),
    )
    const result = await provisionStockfishWebRuntime(fixture.workspace, {
      fetchImplementation: fixture.fetchRuntime,
    })
    expect(result.downloadRecoveries).toHaveLength(2)
    expect(
      result.downloadRecoveries.every((message) =>
        message.includes("fallback succeeded"),
      ),
    ).toBe(true)
    expect(await readFile(result.loaderPath, "utf8")).toBe("Owned test loader")
  })

  it.each(["unexpected-file", "marker", "directory", "digest"] as const)(
    "rejects an existing runtime with invalid $0 without silently replacing it",
    async (corruption) => {
      const fixture = await installationFixture()
      await provisionStockfishWebRuntime(fixture.workspace, {
        fetchImplementation: fixture.fetchRuntime,
      })
      const artifact = STOCKFISH_18_WEB_RUNTIME_ARTIFACTS[0]
      const path = join(fixture.directory, artifact.fileName)
      if (corruption === "unexpected-file")
        await writeFile(join(fixture.directory, "untrusted.bin"), "untrusted")
      else if (corruption === "marker")
        await writeFile(
          join(fixture.directory, ".mapachess-stockfish-web.json"),
          "{}",
        )
      else if (corruption === "directory") {
        await rm(path)
        await mkdir(path)
      } else await writeFile(path, "x".repeat(artifact.byteLength))
      await expect(
        provisionStockfishWebRuntime(fixture.workspace, {
          fetchImplementation: fixture.fetchRuntime,
        }),
      ).rejects.toThrow(
        corruption === "unexpected-file"
          ? "pinned file set"
          : corruption === "marker"
            ? "marker does not match"
            : corruption === "directory"
              ? "must be a file"
              : "SHA-256 mismatch",
      )
      expect(fixture.fetchRuntime).toHaveBeenCalledTimes(2)
    },
  )

  it("never promotes either artifact when its partner fails verification", async () => {
    const fixture = await installationFixture()
    fixture.fetchRuntime.mockImplementation(
      async (input) =>
        new Response(
          String(input).endsWith(".wasm") ? "invalid" : "Owned test loader",
        ),
    )
    await expect(
      provisionStockfishWebRuntime(fixture.workspace, {
        fetchImplementation: fixture.fetchRuntime,
      }),
    ).rejects.toThrow("byte length mismatch")
    await expect(access(fixture.directory)).rejects.toMatchObject({
      code: "ENOENT",
    })
    expect(await readdir(join(fixture.workspace, "apps/web/public"))).toEqual(
      [],
    )
  })
})

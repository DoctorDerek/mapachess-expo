import { createHash } from "node:crypto"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseSha256Hex } from "./buildIdentity"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_RUNTIME_ARTIFACTS,
  STOCKFISH_18_WEB_RUNTIME_IDENTITY,
  STOCKFISH_18_WEB_RUNTIME_RELATIVE_DIRECTORY,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "./webRuntimeIdentity"
import provisionStockfishWebRuntime, {
  resolveStockfishWebRuntimeDirectory,
  validateWebRuntimeArtifactBytes,
} from "./webRuntimeProvision"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

async function temporaryWorkspace(): Promise<string> {
  const workspace = await mkdtemp(
    join(tmpdir(), "mapachess-web-stockfish-test-"),
  )
  temporaryDirectories.push(workspace)
  return workspace
}

describe("Stockfish web runtime pin", () => {
  it("binds the two release assets to exact provenance and UCI identity", () => {
    expect(STOCKFISH_18_WEB_RUNTIME_ARTIFACTS).toHaveLength(2)
    expect(STOCKFISH_18_WEB_LOADER_ARTIFACT).toMatchObject({
      fileName: "stockfish-18-lite-single.js",
      byteLength: 20_670,
      sha256:
        "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
    })
    expect(STOCKFISH_18_WEB_WASM_ARTIFACT).toMatchObject({
      fileName: "stockfish-18-lite-single.wasm",
      byteLength: 7_295_411,
      sha256:
        "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
    })
    expect(STOCKFISH_18_WEB_RUNTIME_IDENTITY).toMatchObject({
      releaseTag: "v18.0.0",
      stockfishJsSourceRevision: "31a98753a5d932511693f44775da908377c24513",
      upstreamStockfishSourceRevision:
        "cb3d4ee9b47d0c5aae855b12379378ea1439675c",
      uciExpectation: {
        name: "Stockfish 18 Lite WASM",
        networkDefaults: {
          big: "nn-9067e33176e8.nnue",
          small: "<empty>",
        },
      },
    })
  })

  it("validates both byte length and SHA-256", () => {
    const bytes = Buffer.from("verified web runtime fixture", "utf8")
    const artifact = {
      fileName: "fixture.wasm",
      byteLength: bytes.byteLength,
      sha256: parseSha256Hex(createHash("sha256").update(bytes).digest("hex")),
      downloadUrl: "https://example.invalid/fixture.wasm",
    }

    expect(() => validateWebRuntimeArtifactBytes(bytes, artifact)).not.toThrow()
    expect(() =>
      validateWebRuntimeArtifactBytes(bytes.subarray(1), artifact),
    ).toThrow("byte length mismatch")
    expect(() =>
      validateWebRuntimeArtifactBytes(Buffer.alloc(bytes.byteLength), artifact),
    ).toThrow("SHA-256 mismatch")
  })

  it("resolves the runtime beneath the exact ignored web boundary", () => {
    const workspace = join(tmpdir(), "mapachess-web-workspace")

    expect(resolveStockfishWebRuntimeDirectory(workspace)).toBe(
      join(
        workspace,
        ...STOCKFISH_18_WEB_RUNTIME_RELATIVE_DIRECTORY.split("/"),
      ),
    )
  })

  it("rejects failed downloads and removes staging output", async () => {
    const workspace = await temporaryWorkspace()
    const requestedUrls: string[] = []
    const fetchImplementation: typeof fetch = async (input) => {
      requestedUrls.push(String(input))
      return new Response(null, { status: 503 })
    }

    await expect(
      provisionStockfishWebRuntime(workspace, { fetchImplementation }),
    ).rejects.toThrow("download failed with HTTP 503")

    expect(requestedUrls.sort()).toEqual(
      STOCKFISH_18_WEB_RUNTIME_ARTIFACTS.map(
        (artifact) => artifact.downloadUrl,
      ).sort(),
    )
    expect(await readdir(join(workspace, "apps", "web", "public"))).toEqual([])
  })

  it("rejects unverified bytes without promoting a runtime", async () => {
    const workspace = await temporaryWorkspace()
    const fetchImplementation: typeof fetch = async () =>
      new Response("not a pinned Stockfish artifact", { status: 200 })

    await expect(
      provisionStockfishWebRuntime(workspace, { fetchImplementation }),
    ).rejects.toThrow("byte length mismatch")

    expect(await readdir(join(workspace, "apps", "web", "public"))).toEqual([])
  })
})

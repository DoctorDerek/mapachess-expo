import { createHash } from "node:crypto"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseSha256Hex } from "./buildIdentity"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_RUNTIME_ARTIFACTS,
  STOCKFISH_18_WEB_RUNTIME_IDENTITY,
  STOCKFISH_18_WEB_RUNTIME_RELATIVE_DIRECTORY,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "./webRuntimeIdentity"
import provisionStockfishWebRuntime, {
  fetchVerifiedWebRuntimeArtifact,
  resolveStockfishWebRuntimeDirectory,
  validateWebRuntimeArtifactBytes,
} from "./webRuntimeProvision"

const temporaryDirectories: string[] = []
const fixtureBytes = Buffer.from("verified web runtime fixture", "utf8")
const fixtureArtifact = {
  fileName: "fixture.wasm",
  byteLength: fixtureBytes.byteLength,
  sha256: parseSha256Hex(
    createHash("sha256").update(fixtureBytes).digest("hex"),
  ),
  downloadUrl: "https://example.invalid/fixture.wasm",
}
const fixtureMirrorUrl = "https://mapachess.com/stockfish-runtime/fixture.wasm"

afterEach(async () => {
  vi.useRealTimers()
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
        requiresSyzygyPath: false,
      },
    })
  })

  it("validates both byte length and SHA-256", () => {
    expect(() =>
      validateWebRuntimeArtifactBytes(fixtureBytes, fixtureArtifact),
    ).not.toThrow()
    expect(() =>
      validateWebRuntimeArtifactBytes(
        fixtureBytes.subarray(1),
        fixtureArtifact,
      ),
    ).toThrow("byte length mismatch")
    expect(() =>
      validateWebRuntimeArtifactBytes(
        Buffer.alloc(fixtureBytes.byteLength),
        fixtureArtifact,
      ),
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
      return new Response(null, { status: 404 })
    }

    await expect(
      provisionStockfishWebRuntime(workspace, { fetchImplementation }),
    ).rejects.toThrow("Mapachess fallback: HTTP 404")

    expect(requestedUrls.sort()).toEqual(
      STOCKFISH_18_WEB_RUNTIME_ARTIFACTS.flatMap((artifact) => [
        artifact.downloadUrl,
        `https://mapachess.com/stockfish-runtime/${artifact.fileName}`,
      ]).sort(),
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

  it("waits for the sibling download before removing failed staging", async () => {
    const workspace = await temporaryWorkspace()
    const requestedUrls: string[] = []
    let finishWasm: (response: Response) => void = () => {
      throw new Error("WASM response was not initialized")
    }
    const pendingWasm = new Promise<Response>((resolve) => {
      finishWasm = resolve
    })
    const fetchImplementation: typeof fetch = async (input) => {
      requestedUrls.push(String(input))
      return String(input) === STOCKFISH_18_WEB_WASM_ARTIFACT.downloadUrl
        ? pendingWasm
        : new Response(null, { status: 404 })
    }
    let settled = false
    const provisioning = provisionStockfishWebRuntime(workspace, {
      fetchImplementation,
    }).finally(() => {
      settled = true
    })
    const rejection = expect(provisioning).rejects.toThrow("HTTP 404")
    await vi.waitFor(() => expect(requestedUrls).toHaveLength(3))

    expect(settled).toBe(false)
    const publicDirectory = join(workspace, "apps", "web", "public")
    expect(await readdir(publicDirectory)).toHaveLength(1)
    finishWasm(new Response("invalid artifact"))
    await rejection
    expect(await readdir(publicDirectory)).toEqual([])
  })
})

describe("Stockfish web runtime download recovery", () => {
  it("uses the pinned upstream first without a fallback or recovery message", async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(fixtureBytes))

    const result = await fetchVerifiedWebRuntimeArtifact(
      fixtureArtifact,
      fetchImplementation,
    )

    expect(result).toEqual({
      bytes: new Uint8Array(fixtureBytes),
      recovery: null,
    })
    expect(fetchImplementation).toHaveBeenCalledExactlyOnceWith(
      fixtureArtifact.downloadUrl,
      { signal: expect.any(AbortSignal) },
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([408, 500, 502, 503, 504])(
    "retries transient HTTP %i with bounded backoff before using the mirror",
    async (status) => {
      vi.useFakeTimers()
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(new Response(fixtureBytes))
      const downloading = fetchVerifiedWebRuntimeArtifact(
        fixtureArtifact,
        fetchImplementation,
      )
      await vi.advanceTimersByTimeAsync(999)
      expect(fetchImplementation).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1_999)
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)

      expect(await downloading).toEqual({
        bytes: new Uint8Array(fixtureBytes),
        recovery: expect.stringContaining("Mapachess fallback succeeded"),
      })
      expect(
        fetchImplementation.mock.calls.map(([url]) => String(url)),
      ).toEqual([
        fixtureArtifact.downloadUrl,
        fixtureArtifact.downloadUrl,
        fixtureArtifact.downloadUrl,
        fixtureMirrorUrl,
      ])
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it("recovers a network error upstream without contacting the mirror", async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network disconnected"))
      .mockResolvedValueOnce(new Response(fixtureBytes))
    const downloading = fetchVerifiedWebRuntimeArtifact(
      fixtureArtifact,
      fetchImplementation,
    )
    await vi.runAllTimersAsync()

    expect((await downloading).recovery).toContain(
      "GitHub succeeded on attempt 2",
    )
    expect(fetchImplementation.mock.calls.map(([url]) => String(url))).toEqual([
      fixtureArtifact.downloadUrl,
      fixtureArtifact.downloadUrl,
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([401, 403, 404, 429, 501])(
    "does not retry HTTP %i without an applicable retry instruction",
    async (status) => {
      vi.useFakeTimers()
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(new Response(fixtureBytes))

      const result = await fetchVerifiedWebRuntimeArtifact(
        fixtureArtifact,
        fetchImplementation,
      )

      expect(result.recovery).toContain("Mapachess fallback succeeded")
      expect(
        fetchImplementation.mock.calls.map(([url]) => String(url)),
      ).toEqual([fixtureArtifact.downloadUrl, fixtureMirrorUrl])
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(["seconds", "date"])(
    "honors a bounded Retry-After %s",
    async (kind) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-09-24T12:00:00Z"))
      const retryAfter =
        kind === "seconds" ? "3" : "Thu, 24 Sep 2026 12:00:03 GMT"
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 429,
            headers: { "Retry-After": retryAfter },
          }),
        )
        .mockResolvedValueOnce(new Response(fixtureBytes))
      const downloading = fetchVerifiedWebRuntimeArtifact(
        fixtureArtifact,
        fetchImplementation,
      )
      await vi.advanceTimersByTimeAsync(2_999)
      expect(fetchImplementation).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      expect((await downloading).recovery).toContain(
        "GitHub succeeded on attempt 2",
      )
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(["11", "not a date", "-1", "0.5"])(
    "uses the fallback rather than retrying an excessive or invalid Retry-After %s",
    async (retryAfter) => {
      vi.useFakeTimers()
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 429,
            headers: { "Retry-After": retryAfter },
          }),
        )
        .mockResolvedValueOnce(new Response(fixtureBytes))

      expect(
        (
          await fetchVerifiedWebRuntimeArtifact(
            fixtureArtifact,
            fetchImplementation,
          )
        ).recovery,
      ).toContain("Mapachess fallback succeeded")
      expect(fetchImplementation).toHaveBeenLastCalledWith(fixtureMirrorUrl, {
        signal: expect.any(AbortSignal),
      })
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(["request", "body"])(
    "times out a stalled %s and clears its timers",
    async (phase) => {
      vi.useFakeTimers()
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(async (_input, init) => {
          const signal = init?.signal
          if (!signal) throw new Error("Missing download abort signal")
          if (phase === "request") {
            return new Promise<Response>((_resolve, reject) => {
              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              })
            })
          }
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                signal.addEventListener(
                  "abort",
                  () => controller.error(signal.reason),
                  { once: true },
                )
              },
            }),
          )
        })
        .mockResolvedValueOnce(new Response(fixtureBytes))
      const downloading = fetchVerifiedWebRuntimeArtifact(
        fixtureArtifact,
        fetchImplementation,
      )
      await vi.advanceTimersByTimeAsync(20_999)
      expect(fetchImplementation).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      expect((await downloading).recovery).toContain("download timed out")
      expect(fetchImplementation).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(["upstream", "mirror"])(
    "fails closed for corrupt %s bytes without further attempts",
    async (source) => {
      vi.useFakeTimers()
      const fetchImplementation = vi.fn<typeof fetch>()
      if (source === "mirror") {
        fetchImplementation.mockResolvedValueOnce(
          new Response(null, { status: 404 }),
        )
      }
      fetchImplementation.mockResolvedValueOnce(
        new Response(Buffer.alloc(fixtureBytes.byteLength)),
      )

      await expect(
        fetchVerifiedWebRuntimeArtifact(fixtureArtifact, fetchImplementation),
      ).rejects.toThrow("SHA-256 mismatch")
      expect(fetchImplementation).toHaveBeenCalledTimes(
        source === "upstream" ? 1 : 2,
      )
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it("stops after the final mirror failure and reports both source failures", async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 503 }))
    const rejection = expect(
      fetchVerifiedWebRuntimeArtifact(fixtureArtifact, fetchImplementation),
    ).rejects.toThrow(
      "GitHub attempt 3: HTTP 503; Mapachess fallback: HTTP 503",
    )
    await vi.runAllTimersAsync()
    await rejection

    expect(fetchImplementation).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(0)
  })
})

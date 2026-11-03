import { afterEach, expect, it, vi } from "vitest"
import {
  STOCKFISH_18_WEB_WASM_ARTIFACT as binary,
  STOCKFISH_18_WEB_LOADER_ARTIFACT as loader,
} from "@mapachess/stockfish/web-runtime-identity"
import prepareWebStockfishProgram, {
  loadWebStockfishBytes,
} from "./prepareWebStockfishProgram"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it("shares verified program bytes across match workers and releases both URLs", async () => {
  const read = vi.fn(
    async (url: string) =>
      new Response(
        new Uint8Array(
          url.endsWith(".wasm") ? binary.byteLength : loader.byteLength,
        ),
      ),
  )
  vi.stubGlobal("fetch", read)
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:loader")
    .mockReturnValueOnce("blob:binary")
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  const signal = new AbortController().signal
  const program = await prepareWebStockfishProgram(signal)
  expect(read).toHaveBeenCalledTimes(2)
  expect(read).toHaveBeenCalledWith("/stockfish-runtime/" + binary.fileName, {
    integrity: expect.stringMatching(/^sha256-/),
  })
  expect(
    create.mock.calls.map(([blob]) =>
      blob instanceof Blob ? blob.type : undefined,
    ),
  ).toEqual(["text/javascript", "application/wasm"])
  expect(program.url).toBe("blob:loader#blob%3Abinary")
  program.release()
  expect(revoke.mock.calls).toEqual([["blob:loader"], ["blob:binary"]])
})
it.each([200, 503])(
  "rejects a missing or truncated program before allocating worker URLs (%i)",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("short", { status })),
    )
    const create = vi.spyOn(URL, "createObjectURL")
    await expect(prepareWebStockfishProgram()).rejects.toThrow(
      status === 200 ? /Incomplete/ : /Unable to load/,
    )
    expect(create).not.toHaveBeenCalled()
  },
)
it("one chess intent installs both pinned files and a later match can read them offline", async () => {
  const files = new Map<string, Response>()
  const cache = {
    match: async (key: string) => files.get(key)?.clone(),
    put: async (key: string, value: Response) => {
      files.set(key, value)
    },
  }
  const open = vi.fn(async () => cache)
  vi.stubGlobal("caches", { open })
  const read = vi.fn(
    async (url: string) =>
      new Response(
        new Uint8Array(
          url.endsWith(".wasm") ? binary.byteLength : loader.byteLength,
        ),
      ),
  )
  vi.stubGlobal("fetch", read)
  const [a, b] = await Promise.all([
    loadWebStockfishBytes(),
    loadWebStockfishBytes(),
  ])
  expect(a).toBe(b)
  expect(read).toHaveBeenCalledTimes(2)
  expect([...files.keys()].sort()).toEqual(
    [loader, binary]
      .map((x) => "/stockfish-runtime/" + x.fileName + "?sha256=" + x.sha256)
      .sort(),
  )
  read.mockRejectedValue(Error("offline"))
  const cached = await loadWebStockfishBytes()
  expect(cached.map((x) => x.size)).toEqual([
    loader.byteLength,
    binary.byteLength,
  ])
  expect(read).toHaveBeenCalledTimes(2)
  expect(open).toHaveBeenCalledTimes(2)
})
it("an already canceled match starts no program download", async () => {
  const read = vi.fn()
  vi.stubGlobal("fetch", read)
  await expect(
    prepareWebStockfishProgram(AbortSignal.abort()),
  ).rejects.toThrow()
  expect(read).not.toHaveBeenCalled()
})

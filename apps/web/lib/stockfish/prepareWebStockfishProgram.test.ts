import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  STOCKFISH_18_WEB_WASM_ARTIFACT as binary,
  STOCKFISH_18_WEB_LOADER_ARTIFACT as loader,
} from "@mapachess/stockfish/web-runtime-identity"

type ProgramModule = typeof import("./prepareWebStockfishProgram")
let loadWebStockfishBytes: ProgramModule["loadWebStockfishBytes"]
let prepareWebStockfishProgram: ProgramModule["default"]

beforeEach(async () => {
  vi.resetModules()
  const program = await import("./prepareWebStockfishProgram")
  loadWebStockfishBytes = program.loadWebStockfishBytes
  prepareWebStockfishProgram = program.default
})

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
it("retries only the missing binary after a partial offline install", async () => {
  const loaderKey =
    "/stockfish-runtime/" + loader.fileName + "?sha256=" + loader.sha256
  const binaryUrl = "/stockfish-runtime/" + binary.fileName
  const cache = {
    match: async (key: string) =>
      key === loaderKey
        ? new Response(new Uint8Array(loader.byteLength))
        : undefined,
    put: vi.fn(async () => undefined),
  }
  vi.stubGlobal("caches", { open: async () => cache })
  const read = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(new Uint8Array(binary.byteLength)))
  vi.stubGlobal("fetch", read)

  await expect(loadWebStockfishBytes()).rejects.toThrow(
    "Unable to load " + binary.fileName,
  )
  expect(cache.put).not.toHaveBeenCalled()
  const bytes = await loadWebStockfishBytes()
  expect(bytes.map((file) => file.size)).toEqual([
    loader.byteLength,
    binary.byteLength,
  ])
  expect(read.mock.calls.map(([url]) => url)).toEqual([binaryUrl, binaryUrl])
  expect(cache.put).toHaveBeenCalledOnce()
})
it("retries a failed loader while sharing its still-downloading binary", async () => {
  const transfer = Promise.withResolvers<Response>()
  let loaderRequests = 0
  const read = vi.fn(async (url: string) => {
    if (url.endsWith(".wasm")) return (await transfer.promise).clone()
    loaderRequests += 1
    return loaderRequests === 1
      ? new Response(null, { status: 503 })
      : new Response(new Uint8Array(loader.byteLength))
  })
  vi.stubGlobal("fetch", read)
  await expect(loadWebStockfishBytes()).rejects.toThrow(loader.fileName)
  const retry = loadWebStockfishBytes()
  await vi.waitFor(() => expect(loaderRequests).toBe(2))
  transfer.resolve(new Response(new Uint8Array(binary.byteLength)))
  const bytes = await retry
  expect(bytes[1].size).toBe(binary.byteLength)
  expect(read.mock.calls.filter(([url]) => url.endsWith(".wasm"))).toHaveLength(
    1,
  )
})

it.each(["disabled", "full"])(
  "reuses verified bytes when storage is %s",
  async (storage) => {
    vi.stubGlobal("caches", {
      open: async () => {
        if (storage === "disabled") throw Error("Storage disabled")
        return {
          match: async () => undefined,
          put: async () => {
            throw Error("Quota exceeded")
          },
        }
      },
    })
    const read = vi.fn(
      async (url: string) =>
        new Response(
          new Uint8Array(
            url.endsWith(".wasm") ? binary.byteLength : loader.byteLength,
          ),
        ),
    )
    vi.stubGlobal("fetch", read)
    await loadWebStockfishBytes()
    const match = await loadWebStockfishBytes()
    expect(match.map((file) => file.size)).toEqual([
      loader.byteLength,
      binary.byteLength,
    ])
    expect(read).toHaveBeenCalledTimes(2)
  },
)

it("persists the page's bytes when storage becomes available again", async () => {
  const files = new Map<string, Response>()
  const open = vi
    .fn(async () => ({
      match: async (key: string) => files.get(key)?.clone(),
      put: async (key: string, value: Response) => {
        files.set(key, value)
      },
    }))
    .mockRejectedValueOnce(Error("Storage disabled"))
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
  await loadWebStockfishBytes()
  expect(files.size).toBe(0)
  await loadWebStockfishBytes()
  expect(files.size).toBe(2)
  read.mockRejectedValue(Error("offline"))
  vi.resetModules()
  const nextPage = await import("./prepareWebStockfishProgram")
  const bytes = await nextPage.loadWebStockfishBytes()
  expect(bytes[1].size).toBe(binary.byteLength)
  expect(read).toHaveBeenCalledTimes(2)
})

it("an already canceled match starts no program download", async () => {
  const read = vi.fn()
  vi.stubGlobal("fetch", read)
  await expect(
    prepareWebStockfishProgram(AbortSignal.abort()),
  ).rejects.toThrow()
  expect(read).not.toHaveBeenCalled()
})

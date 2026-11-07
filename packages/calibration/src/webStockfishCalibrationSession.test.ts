import { createHash } from "node:crypto"
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"
import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
} from "@mapachess/stockfish/web-runtime-identity"
import { resolveStockfishWebRuntimeDirectory } from "@mapachess/stockfish/web-runtime-provision"
import openWebStockfishCalibrationSession from "./webStockfishCalibrationSession"

const io = vi.hoisted(() => ({
  loaderPath: "",
  failOpen: false,
  failClose: false,
  loader:
    'process.stdin.resume(); process.stdin.on("data", chunk => { for (const command of chunk.toString().trim().split("\\n")) { if (command === "quit") process.exit(0); } });',
  wasm: "Owned calibration WASM placeholder",
}))
vi.mock("@mapachess/stockfish/web-runtime-identity", async (original) => {
  const actual =
    await original<typeof import("@mapachess/stockfish/web-runtime-identity")>()
  const { parseSha256Hex } = await import("@mapachess/stockfish/build-identity")
  const artifact = (
    source:
      | typeof actual.STOCKFISH_18_WEB_LOADER_ARTIFACT
      | typeof actual.STOCKFISH_18_WEB_WASM_ARTIFACT,
    bytes: string,
  ) => ({
    ...source,
    byteLength: Buffer.byteLength(bytes),
    sha256: parseSha256Hex(createHash("sha256").update(bytes).digest("hex")),
  })
  return {
    ...actual,
    STOCKFISH_18_WEB_LOADER_ARTIFACT: artifact(
      actual.STOCKFISH_18_WEB_LOADER_ARTIFACT,
      io.loader,
    ),
    STOCKFISH_18_WEB_WASM_ARTIFACT: artifact(
      actual.STOCKFISH_18_WEB_WASM_ARTIFACT,
      io.wasm,
    ),
  }
})
vi.mock("@mapachess/stockfish/uci-process-adapter", async (original) => {
  const actual =
    await original<typeof import("@mapachess/stockfish/uci-process-adapter")>()
  return {
    ...actual,
    createNodeUciTransport: (path: string, args: readonly string[]) => {
      io.loaderPath = args[0] ?? ""
      if (io.failOpen) throw new Error("Owned process-start failure")
      return actual.createNodeUciTransport(path, args)
    },
  }
})
vi.mock("@mapachess/stockfish/uci-session", async (original) => {
  const actual =
    await original<typeof import("@mapachess/stockfish/uci-session")>()
  return {
    ...actual,
    default: (...args: Parameters<typeof actual.default>) => {
      const session = actual.default(...args)
      return {
        ...session,
        close: async () => {
          await session.close()
          if (io.failClose) throw new Error("Owned close failure")
        },
      }
    },
  }
})
afterEach(() => {
  io.failOpen = false
  io.failClose = false
  io.loaderPath = ""
})

const configuration = {
  variant: "standard",
  strength: { kind: "full-strength" },
  threads: 1,
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
} as const
async function runtime() {
  const workspace = await mkdtemp(
    join(tmpdir(), "mapachess-calibration-session-"),
  )
  onTestFinished(() => rm(workspace, { recursive: true, force: true }))
  const directory = resolveStockfishWebRuntimeDirectory(workspace)
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName),
    io.loader,
  )
  await writeFile(
    join(directory, STOCKFISH_18_WEB_WASM_ARTIFACT.fileName),
    io.wasm,
  )
  return { workspace, directory }
}

describe("temporary web-calibration runtime ownership", () => {
  it.each([false, true])(
    "copies only verified runtime bytes and removes the execution directory even when close fails: %s",
    async (failClose) => {
      const fixture = await runtime()
      const session = await openWebStockfishCalibrationSession(
        fixture.workspace,
        configuration,
      )
      onTestFinished(async () => {
        io.failClose = false
        await session.close()
      })
      expect(io.loaderPath.endsWith(".cjs")).toBe(true)
      expect(await readFile(io.loaderPath, "utf8")).toBe(io.loader)
      expect(
        await readFile(
          join(dirname(io.loaderPath), STOCKFISH_18_WEB_WASM_ARTIFACT.fileName),
          "utf8",
        ),
      ).toBe(io.wasm)
      io.failClose = failClose
      if (failClose)
        await expect(session.close()).rejects.toThrow("Owned close failure")
      else await session.close()
      await expect(access(dirname(io.loaderPath))).rejects.toMatchObject({
        code: "ENOENT",
      })
      expect(
        await readFile(
          join(fixture.directory, STOCKFISH_18_WEB_LOADER_ARTIFACT.fileName),
          "utf8",
        ),
      ).toBe(io.loader)
    },
  )

  it("removes the temporary execution copy after process construction fails, retaining the installed runtime", async () => {
    const fixture = await runtime()
    io.failOpen = true
    await expect(
      openWebStockfishCalibrationSession(fixture.workspace, configuration),
    ).rejects.toThrow("Owned process-start failure")
    await expect(access(dirname(io.loaderPath))).rejects.toMatchObject({
      code: "ENOENT",
    })
    expect(
      await readFile(
        join(fixture.directory, STOCKFISH_18_WEB_WASM_ARTIFACT.fileName),
        "utf8",
      ),
    ).toBe(io.wasm)
  })

  it("refuses corrupted installed bytes before creating a process or execution copy", async () => {
    const fixture = await runtime()
    await writeFile(
      join(fixture.directory, STOCKFISH_18_WEB_WASM_ARTIFACT.fileName),
      "Corrupted bytes",
    )
    await expect(
      openWebStockfishCalibrationSession(fixture.workspace, configuration),
    ).rejects.toThrow()
    expect(io.loaderPath).toBe("")
  })
})

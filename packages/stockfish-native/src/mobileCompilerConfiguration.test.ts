import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST } from "./nativeBuildIdentity"

describe("Stockfish mobile compiler configuration", () => {
  it("defines boolean feature flags as numeric preprocessor expressions", async () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const configuration = await readFile(
      resolve(packageRoot, "cpp", "StockfishMobileConfig.h"),
      "utf8",
    )

    expect(configuration).toMatch(/^\s*#define IS_64BIT 1$/mu)
    expect(configuration).toMatch(/^#define USE_PTHREADS 1$/mu)
    expect(configuration).toMatch(/^#define __LITE_NET__ 1$/mu)
    expect(configuration).toMatch(/^#define __NO_SYZYGY__ 1$/mu)
    expect(configuration).toMatch(/^#define __ENGINE_VERSION__ "18 Lite"$/mu)
    expect(configuration).toMatch(/^\s*#define USE_POPCNT 1$/mu)
    expect(configuration).toMatch(/^\s*#define USE_SSE2 1$/mu)
    expect(configuration).toMatch(/^\s*#define NO_PREFETCH 1$/mu)
  })

  it("selects the same Lite inputs and shared configuration for both native compiler owners", async () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const [android, ios] = await Promise.all([
      readFile(resolve(packageRoot, "android", "CMakeLists.txt"), "utf8"),
      readFile(resolve(packageRoot, "MapachessStockfish.podspec"), "utf8"),
    ])
    const { inputId, network } = STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST

    for (const compiler of [android, ios]) {
      expect(compiler).toContain(`.stockfish-networks/${inputId}`)
      expect(compiler).toContain("StockfishMobileConfig.h")
    }
    expect(android).toContain(network.fileName)
    expect(android).not.toContain("syzygy/tbprobe.cpp")
    expect(ios).toMatch(
      /specification\.exclude_files =\s*"third_party\/stockfish\/src\/main\.cpp",\s*"third_party\/stockfish\/src\/syzygy\/tbprobe\.cpp"/u,
    )
  })
})

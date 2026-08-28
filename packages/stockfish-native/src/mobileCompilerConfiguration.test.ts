import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

describe("Stockfish mobile compiler configuration", () => {
  it("defines boolean feature flags as numeric preprocessor expressions", async () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const configuration = await readFile(
      resolve(packageRoot, "cpp", "StockfishMobileConfig.h"),
      "utf8",
    )

    expect(configuration).toMatch(/^\s*#define IS_64BIT 1$/mu)
    expect(configuration).toMatch(/^#define USE_PTHREADS 1$/mu)
    expect(configuration).toMatch(/^\s*#define USE_POPCNT 1$/mu)
    expect(configuration).toMatch(/^\s*#define USE_SSE2 1$/mu)
    expect(configuration).toMatch(/^\s*#define NO_PREFETCH 1$/mu)
  })
})

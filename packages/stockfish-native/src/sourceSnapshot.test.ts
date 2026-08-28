import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { STOCKFISH_18_SOURCE_SNAPSHOT_SHA256 } from "./nativeBuildIdentity"
import { sha256StockfishSourceSnapshot } from "./sourceSnapshot"

describe("Stockfish source snapshot", () => {
  it("matches the pinned Stockfish 18 source lineage", async () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const sourceRoot = resolve(packageRoot, "third_party", "stockfish")

    await expect(sha256StockfishSourceSnapshot(sourceRoot)).resolves.toBe(
      STOCKFISH_18_SOURCE_SNAPSHOT_SHA256,
    )
  })
})

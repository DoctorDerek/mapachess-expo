import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  STOCKFISH_18_WEB_SOURCE_REVISION,
  STOCKFISH_18_WEB_UCI_EXPECTATION,
} from "@mapachess/stockfish/web-runtime-identity"
import {
  STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST,
  STOCKFISH_18_LITE_SOURCE_SNAPSHOT_SHA256,
} from "./nativeBuildIdentity"
import { sha256StockfishSourceSnapshot } from "./sourceSnapshot"

describe("Stockfish source snapshot", () => {
  it("keeps native source and network pins aligned with the selected web Lite lineage", () => {
    expect(STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST.sourceRevision).toBe(
      STOCKFISH_18_WEB_SOURCE_REVISION,
    )
    expect(STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST.network.fileName).toBe(
      STOCKFISH_18_WEB_UCI_EXPECTATION.networkDefaults.big,
    )
    expect(STOCKFISH_18_WEB_UCI_EXPECTATION.networkDefaults.small).toBe(
      "<empty>",
    )
  })

  it("matches the pinned Stockfish Lite source and native embedding patch", async () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
    const sourceRoot = resolve(packageRoot, "third_party", "stockfish")

    await expect(sha256StockfishSourceSnapshot(sourceRoot)).resolves.toBe(
      STOCKFISH_18_LITE_SOURCE_SNAPSHOT_SHA256,
    )
  })
})

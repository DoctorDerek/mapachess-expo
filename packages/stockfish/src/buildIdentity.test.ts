import { describe, expect, it } from "vitest"
import {
  parseSha256Hex,
  STOCKFISH_18_ARTIFACT,
  STOCKFISH_18_BUILD_IDENTITY,
  STOCKFISH_18_RUNTIME_TARGET,
  STOCKFISH_18_SOURCE_REVISION,
  validateStockfish18Host,
  validateStockfishBuildIdentity,
  type StockfishBuildIdentity,
} from "./buildIdentity"

describe("Stockfish 18 build identity", () => {
  it("binds the Windows artifact to the exact source and two NNUE networks", () => {
    expect(STOCKFISH_18_ARTIFACT.target).toBe(STOCKFISH_18_RUNTIME_TARGET)
    expect(STOCKFISH_18_BUILD_IDENTITY).toMatchObject({
      name: "stockfish",
      version: "18",
      releaseTag: "sf_18",
      sourceRevision: STOCKFISH_18_SOURCE_REVISION,
      archiveSha256: STOCKFISH_18_ARTIFACT.archiveSha256,
      executableSha256: STOCKFISH_18_ARTIFACT.executableSha256,
      networks: {
        big: { fileName: "nn-c288c895ea92.nnue" },
        small: { fileName: "nn-37f18f62d772.nnue" },
      },
    })
    expect(() =>
      validateStockfishBuildIdentity(STOCKFISH_18_BUILD_IDENTITY),
    ).not.toThrow()
  })

  it("accepts the supported local host", () => {
    expect(() => validateStockfish18Host("win32", "x64")).not.toThrow()
  })

  it.each([
    ["darwin", "x64"],
    ["linux", "x64"],
    ["win32", "arm64"],
  ] as const)("rejects unsupported host %s-%s", (platform, architecture) => {
    expect(() => validateStockfish18Host(platform, architecture)).toThrow(
      `does not support ${platform}-${architecture}`,
    )
  })

  it("rejects an NNUE filename that does not match its full digest", () => {
    const invalidIdentity = {
      ...STOCKFISH_18_BUILD_IDENTITY,
      networks: {
        ...STOCKFISH_18_BUILD_IDENTITY.networks,
        big: {
          ...STOCKFISH_18_BUILD_IDENTITY.networks.big,
          fileName: "nn-wrong.nnue",
        },
      },
    } as StockfishBuildIdentity

    expect(() => validateStockfishBuildIdentity(invalidIdentity)).toThrow(
      "networks.big.fileName must be",
    )
  })

  it("rejects a malformed digest", () => {
    expect(() => parseSha256Hex("ABC", "artifact digest")).toThrow(
      "artifact digest must be exactly 64 lowercase hexadecimal characters.",
    )
  })
})

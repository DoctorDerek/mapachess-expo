import { describe, expect, it } from "vitest"
import {
  createStockfish18BuildIdentity,
  parseSha256Hex,
  STOCKFISH_18_ARTIFACTS,
  stockfishRuntimeTargetForHost,
  validateStockfishBuildIdentity,
  type StockfishBuildIdentity,
} from "./buildIdentity"

describe("Stockfish 18 build identity", () => {
  it.each(["windows-x64", "linux-x64"] as const)(
    "binds the %s artifact to the exact source and two NNUE networks",
    (target) => {
      const artifact = STOCKFISH_18_ARTIFACTS[target]
      const identity = createStockfish18BuildIdentity(target)

      expect(identity).toMatchObject({
        name: "stockfish",
        version: "18",
        releaseTag: "sf_18",
        sourceRevision: "cb3d4ee9b47d0c5aae855b12379378ea1439675c",
        archiveSha256: artifact.archiveSha256,
        executableSha256: artifact.executableSha256,
        networks: {
          big: { fileName: "nn-c288c895ea92.nnue" },
          small: { fileName: "nn-37f18f62d772.nnue" },
        },
      })
    },
  )

  it.each([
    ["win32", "x64", "windows-x64"],
    ["linux", "x64", "linux-x64"],
  ] as const)("maps %s-%s to %s", (platform, architecture, expected) => {
    expect(stockfishRuntimeTargetForHost(platform, architecture)).toBe(expected)
  })

  it.each([
    ["darwin", "x64"],
    ["win32", "arm64"],
  ] as const)("rejects unsupported host %s-%s", (platform, architecture) => {
    expect(() => stockfishRuntimeTargetForHost(platform, architecture)).toThrow(
      `does not support ${platform}-${architecture}`,
    )
  })

  it("rejects an NNUE filename that does not match its full digest", () => {
    const identity = createStockfish18BuildIdentity("windows-x64")
    const invalidIdentity = {
      ...identity,
      networks: {
        ...identity.networks,
        big: { ...identity.networks.big, fileName: "nn-wrong.nnue" },
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

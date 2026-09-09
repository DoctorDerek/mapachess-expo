import { createHash } from "node:crypto"
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseSha256Hex } from "@mapachess/stockfish/build-identity"
import {
  STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST,
  type StockfishNativeBuildManifest,
} from "./nativeBuildIdentity"
import { provisionStockfishNativeNetwork } from "./provision"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

function networkIdentity(bytes: Uint8Array) {
  const sha256 = parseSha256Hex(
    createHash("sha256").update(bytes).digest("hex"),
  )
  return {
    fileName: `nn-${sha256.slice(0, 12)}.nnue`,
    sha256,
  }
}

function fixtureManifest(
  networkBytes: Uint8Array,
): StockfishNativeBuildManifest {
  return {
    schemaVersion: 2,
    inputId: "fixture",
    sourceRevision: "a".repeat(40),
    sourceSnapshotSha256: parseSha256Hex("b".repeat(64)),
    network: {
      ...networkIdentity(networkBytes),
      urls: ["https://example.invalid/network"],
    },
  }
}

async function temporaryPackageRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "mapachess-native-inputs-"))
  temporaryDirectories.push(directory)
  return directory
}

describe("native Stockfish input provisioning", () => {
  it("pins official HTTPS sources for the Lite network", () => {
    const artifact = STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST.network
    expect(artifact.urls).toHaveLength(2)
    expect(artifact.urls.every((url) => url.startsWith("https://"))).toBe(true)
  })

  it("promotes verified downloads atomically and reuses them", async () => {
    const packageRoot = await temporaryPackageRoot()
    const networkBytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(networkBytes)
    let downloadCount = 0
    const download = async (): Promise<Uint8Array> => {
      downloadCount += 1
      return networkBytes
    }

    const first = await provisionStockfishNativeNetwork({
      packageRoot,
      manifest,
      download,
    })
    const second = await provisionStockfishNativeNetwork({
      packageRoot,
      manifest,
      download,
    })

    expect(second).toEqual(first)
    expect(downloadCount).toBe(1)
    await expect(readFile(first.networkPath)).resolves.toEqual(networkBytes)
    await expect(readFile(first.markerPath, "utf8")).resolves.toBe(
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
  })

  it("rejects digest mismatches without promoting partial inputs", async () => {
    const packageRoot = await temporaryPackageRoot()
    const networkBytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(networkBytes)

    await expect(
      provisionStockfishNativeNetwork({
        packageRoot,
        manifest,
        download: async () => Buffer.from("corrupt"),
      }),
    ).rejects.toThrow("SHA-256 mismatch")

    const storageEntries = await readdir(
      join(packageRoot, ".stockfish-networks"),
    )
    expect(storageEntries).toEqual([])
  })

  it("rejects a corrupted installed network before redownloading", async () => {
    const packageRoot = await temporaryPackageRoot()
    const networkBytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(networkBytes)
    const first = await provisionStockfishNativeNetwork({
      packageRoot,
      manifest,
      download: async () => networkBytes,
    })
    await writeFile(first.networkPath, "tampered")
    let downloadCount = 0

    await expect(
      provisionStockfishNativeNetwork({
        packageRoot,
        manifest,
        download: async () => {
          downloadCount += 1
          return networkBytes
        },
      }),
    ).rejects.toThrow("network SHA-256 mismatch")
    expect(downloadCount).toBe(0)
  })

  it("rejects a network filename that can escape its owner", async () => {
    const packageRoot = await temporaryPackageRoot()
    const bytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(bytes)
    const unsafeManifest = {
      ...manifest,
      network: { ...manifest.network, fileName: "../escape.nnue" },
    }

    await expect(
      provisionStockfishNativeNetwork({
        packageRoot,
        manifest: unsafeManifest,
        download: async () => bytes,
      }),
    ).rejects.toThrow("fileName does not match its SHA-256")
  })

  it("rejects an input identity that can escape network storage", async () => {
    const packageRoot = await temporaryPackageRoot()
    const bytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(bytes)
    const unsafeManifest = { ...manifest, inputId: "../escape" }

    await expect(
      provisionStockfishNativeNetwork({
        packageRoot,
        manifest: unsafeManifest,
        download: async () => bytes,
      }),
    ).rejects.toThrow("inputId must be a safe path segment")
  })
})

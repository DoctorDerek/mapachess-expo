import { createHash } from "node:crypto"
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseSha256Hex } from "@mapachess/stockfish/build-identity"
import {
  STOCKFISH_18_NATIVE_BUILD_MANIFEST,
  type StockfishNativeBuildManifest,
} from "./nativeBuildIdentity"
import { provisionStockfishNativeNetworks } from "./provision"

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
  bigBytes: Uint8Array,
  smallBytes: Uint8Array,
): StockfishNativeBuildManifest {
  return {
    schemaVersion: 1,
    releaseTag: "fixture",
    sourceRevision: "a".repeat(40),
    sourceSnapshotSha256: parseSha256Hex("b".repeat(64)),
    networks: {
      big: {
        ...networkIdentity(bigBytes),
        urls: ["https://example.invalid/big"],
      },
      small: {
        ...networkIdentity(smallBytes),
        urls: ["https://example.invalid/small"],
      },
    },
  }
}

async function temporaryPackageRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "mapachess-native-inputs-"))
  temporaryDirectories.push(directory)
  return directory
}

describe("native Stockfish input provisioning", () => {
  it("pins official HTTPS sources for both release networks", () => {
    for (const artifact of Object.values(
      STOCKFISH_18_NATIVE_BUILD_MANIFEST.networks,
    )) {
      expect(artifact.urls).toHaveLength(2)
      expect(artifact.urls.every((url) => url.startsWith("https://"))).toBe(
        true,
      )
    }
  })

  it("promotes verified downloads atomically and reuses them", async () => {
    const packageRoot = await temporaryPackageRoot()
    const bigBytes = Buffer.from("fixture-big-network")
    const smallBytes = Buffer.from("fixture-small-network")
    const manifest = fixtureManifest(bigBytes, smallBytes)
    let downloadCount = 0
    const download = async (url: string): Promise<Uint8Array> => {
      downloadCount += 1
      return url.endsWith("/big") ? bigBytes : smallBytes
    }

    const first = await provisionStockfishNativeNetworks({
      packageRoot,
      manifest,
      download,
    })
    const second = await provisionStockfishNativeNetworks({
      packageRoot,
      manifest,
      download,
    })

    expect(second).toEqual(first)
    expect(downloadCount).toBe(2)
    await expect(readFile(first.networks.big)).resolves.toEqual(bigBytes)
    await expect(readFile(first.networks.small)).resolves.toEqual(smallBytes)
    await expect(readFile(first.markerPath, "utf8")).resolves.toBe(
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
  })

  it("rejects digest mismatches without promoting partial inputs", async () => {
    const packageRoot = await temporaryPackageRoot()
    const bigBytes = Buffer.from("fixture-big-network")
    const smallBytes = Buffer.from("fixture-small-network")
    const manifest = fixtureManifest(bigBytes, smallBytes)

    await expect(
      provisionStockfishNativeNetworks({
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
    const bigBytes = Buffer.from("fixture-big-network")
    const smallBytes = Buffer.from("fixture-small-network")
    const manifest = fixtureManifest(bigBytes, smallBytes)
    const first = await provisionStockfishNativeNetworks({
      packageRoot,
      manifest,
      download: async (url) => (url.endsWith("/big") ? bigBytes : smallBytes),
    })
    await writeFile(first.networks.big, "tampered")
    let downloadCount = 0

    await expect(
      provisionStockfishNativeNetworks({
        packageRoot,
        manifest,
        download: async () => {
          downloadCount += 1
          return bigBytes
        },
      }),
    ).rejects.toThrow("big-network SHA-256 mismatch")
    expect(downloadCount).toBe(0)
  })

  it("rejects a network filename that can escape its owner", async () => {
    const packageRoot = await temporaryPackageRoot()
    const bytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(bytes, Buffer.from("second-network"))
    const unsafeManifest = {
      ...manifest,
      networks: {
        ...manifest.networks,
        big: { ...manifest.networks.big, fileName: "../escape.nnue" },
      },
    }

    await expect(
      provisionStockfishNativeNetworks({
        packageRoot,
        manifest: unsafeManifest,
        download: async () => bytes,
      }),
    ).rejects.toThrow("fileName does not match its SHA-256")
  })

  it("rejects a release tag that can escape network storage", async () => {
    const packageRoot = await temporaryPackageRoot()
    const bytes = Buffer.from("fixture-network")
    const manifest = fixtureManifest(bytes, Buffer.from("second-network"))
    const unsafeManifest = { ...manifest, releaseTag: "../escape" }

    await expect(
      provisionStockfishNativeNetworks({
        packageRoot,
        manifest: unsafeManifest,
        download: async () => bytes,
      }),
    ).rejects.toThrow("releaseTag must be a safe path segment")
  })
})

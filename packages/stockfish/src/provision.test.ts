import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  resolveStockfishInstallPaths,
  sha256File,
  validateArchiveEntryPaths,
} from "./provision"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

describe("Stockfish provisioning boundaries", () => {
  it("resolves every generated path beneath the ignored workspace store", () => {
    const workspaceRoot = join(tmpdir(), "mapachess-workspace")
    const paths = resolveStockfishInstallPaths(workspaceRoot)

    expect(paths.storageDirectory.endsWith(".stockfish")).toBe(true)
    expect(
      paths.installDirectory.endsWith(
        join(".stockfish", "sf_18", "windows-x64"),
      ),
    ).toBe(true)
    expect(paths.executablePath.endsWith("stockfish-windows-x86-64.exe")).toBe(
      true,
    )
  })

  it("accepts only entries beneath the expected archive root", () => {
    expect(() =>
      validateArchiveEntryPaths(
        ["stockfish/", "stockfish/Copying.txt", "stockfish/src/main.cpp"],
        "stockfish",
      ),
    ).not.toThrow()

    expect(() =>
      validateArchiveEntryPaths(
        ["stockfish/Copying.txt", "../outside.txt"],
        "stockfish",
      ),
    ).toThrow("archive entry must be a safe relative path")
    expect(() =>
      validateArchiveEntryPaths(["other/file"], "stockfish"),
    ).toThrow("must stay under stockfish/")
  })

  it("hashes files without loading their identity from machine state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mapachess-stockfish-test-"))
    temporaryDirectories.push(directory)
    const fixturePath = join(directory, "fixture.bin")
    const fixture = Buffer.from("Mapachess Stockfish provenance", "utf8")
    await writeFile(fixturePath, fixture)

    expect(await sha256File(fixturePath)).toBe(
      createHash("sha256").update(fixture).digest("hex"),
    )
  })
})

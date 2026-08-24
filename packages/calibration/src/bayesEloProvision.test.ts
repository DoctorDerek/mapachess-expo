import { createHash } from "node:crypto"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { BAYES_ELO_EXECUTABLE_IDENTITY } from "./bayesEloIdentity"
import provisionBayesElo, {
  resolveBayesEloInstallPaths,
  validateBayesEloHost,
  verifyBayesEloExecutable,
} from "./bayesEloProvision"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

describe("BayesElo provisioning", () => {
  it("pins the official version 0056 Windows executable", () => {
    expect(BAYES_ELO_EXECUTABLE_IDENTITY).toEqual({
      downloadUrl: "https://www.remi-coulom.fr/Bayesian-Elo/bayeselo.exe",
      fileName: "bayeselo.exe",
      name: "bayeselo",
      sha256:
        "1b2327219f21bc3185b479436d734073d8795acd85323d86fd5a3dd57096601d",
      version: "0056",
    })
  })

  it("resolves the executable beneath the ignored local store", () => {
    const workspaceRoot = join(tmpdir(), "mapachess-workspace")
    const paths = resolveBayesEloInstallPaths(workspaceRoot)

    expect(paths.storageDirectory.endsWith(".bayeselo")).toBe(true)
    expect(paths.installDirectory.endsWith(join(".bayeselo", "0056"))).toBe(
      true,
    )
    expect(paths.executablePath.endsWith(join("0056", "bayeselo.exe"))).toBe(
      true,
    )
  })

  it("accepts Windows and rejects unsupported hosts", () => {
    expect(() => validateBayesEloHost("win32")).not.toThrow()
    expect(() => validateBayesEloHost("linux")).toThrow(
      "BayesElo 0056 provisioning does not support linux.",
    )
  })

  it("rejects bytes that do not match the executable pin", () => {
    const bytes = Buffer.from("not BayesElo", "utf8")
    const sha256 = createHash("sha256").update(bytes).digest("hex")

    expect(() => verifyBayesEloExecutable(bytes)).toThrow(
      `BayesElo executable SHA-256 mismatch: expected ${BAYES_ELO_EXECUTABLE_IDENTITY.sha256}, received ${sha256}.`,
    )
  })

  it("removes a staged download when verification fails", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "mapachess-bayeselo-test-"),
    )
    temporaryDirectories.push(workspaceRoot)
    const bytes = Buffer.from("altered BayesElo", "utf8")

    await expect(
      provisionBayesElo(
        workspaceRoot,
        async (url) => {
          expect(url).toBe(BAYES_ELO_EXECUTABLE_IDENTITY.downloadUrl)
          return bytes
        },
        "win32",
      ),
    ).rejects.toThrow("BayesElo executable SHA-256 mismatch")

    const paths = resolveBayesEloInstallPaths(workspaceRoot)
    await expect(stat(paths.executablePath)).rejects.toMatchObject({
      code: "ENOENT",
    })
  })
})

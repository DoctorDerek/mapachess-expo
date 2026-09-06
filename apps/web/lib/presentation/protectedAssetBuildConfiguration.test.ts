import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import rootPackage from "../../../../package.json"
import rootTurbo from "../../../../turbo.json"
import webTurbo from "../../turbo.json"

const executeFile = promisify(execFile)
const turboEntry = createRequire(import.meta.url).resolve("turbo")
const rootGitIgnore = await readFile(
  new URL("../../../../.gitignore", import.meta.url),
  "utf8",
)
const FIXTURE_KEY = "A".repeat(43)
const ROOT_INPUTS = [
  "ghost_assets/presentation-assets.zip",
  "ghost_assets/presentation-assets.manifest.json",
  "scripts/decrypt-assets.ts",
  "scripts/ghost-assets/presentationAssetArchive.ts",
  "tsconfig.json",
  "vendor/presentation-assets/fixture.png",
]

const FIXTURE_PREPARE = `
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
const localSource = "../../vendor/presentation-assets/fixture.png";
const key = process.env.GHOST_ASSET_KEY_MAPACHESS;
const hasLocalAssets = existsSync(localSource);
if (!hasLocalAssets && key !== undefined && key !== "${FIXTURE_KEY}") throw new Error("Invalid fixture key");
const licensed = hasLocalAssets || key !== undefined;
await appendFile("../../preparations.txt", "prepared\\n");
await rm("public/generated/presentation-assets", { recursive: true, force: true });
if (licensed) {
  await mkdir("public/generated/presentation-assets", { recursive: true });
  await writeFile("public/generated/presentation-assets/fixture.png", await readFile(hasLocalAssets ? localSource : "../../ghost_assets/presentation-assets.zip"));
}
`

const FIXTURE_BUILD = `
import { existsSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
const licensed = existsSync("public/generated/presentation-assets/fixture.png");
await appendFile("../../executions.txt", "executed\\n");
await mkdir("public/stockfish-runtime", { recursive: true });
await writeFile("public/stockfish-runtime/fixture.js", "fixture runtime");
await mkdir(".next/cache", { recursive: true });
await writeFile(".next/fixture.txt", licensed ? "licensed" : "fallback");
await writeFile(".next/cache/fixture.txt", "uncached compilation cache");
`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const parseWebTask = (
  output: string,
  taskName: "build" | "assets:prepare" = "build",
): Readonly<{ hash: string; inputs: readonly string[] }> => {
  const plan: unknown = JSON.parse(output)
  if (!isRecord(plan) || !Array.isArray(plan.tasks))
    throw new Error("Invalid fixture task plan")
  const task = plan.tasks.find(
    (value: unknown): value is Record<string, unknown> =>
      isRecord(value) && value.taskId === `@mapachess/web#${taskName}`,
  )
  if (!task || typeof task.hash !== "string" || !isRecord(task.inputs))
    throw new Error("Missing fixture web build identity")
  return { hash: task.hash, inputs: Object.keys(task.inputs) }
}

describe("protected web build configuration", () => {
  let repositoryRoot: string
  let webRoot: string

  const writeFixtureFile = async (
    path: string,
    contents: string,
  ): Promise<void> => {
    const destination = join(repositoryRoot, path)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, contents)
  }

  beforeEach(async () => {
    repositoryRoot = await mkdtemp(join(tmpdir(), "mapachess-build-"))
    webRoot = join(repositoryRoot, "apps/web")
    await writeFixtureFile(
      "package.json",
      JSON.stringify({
        name: "mapachess-build-fixture",
        private: true,
        packageManager: rootPackage.packageManager,
      }),
    )
    await writeFixtureFile("pnpm-workspace.yaml", "packages:\n  - apps/*\n")
    await writeFixtureFile(
      "pnpm-lock.yaml",
      "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/web: {}\n",
    )
    await writeFixtureFile(
      ".gitignore",
      `${rootGitIgnore}\nexecutions.txt\npreparations.txt\n`,
    )
    await writeFixtureFile("turbo.json", JSON.stringify(rootTurbo))
    await writeFixtureFile("apps/web/turbo.json", JSON.stringify(webTurbo))
    await writeFixtureFile(
      "apps/web/package.json",
      JSON.stringify({
        name: "@mapachess/web",
        private: true,
        scripts: {
          "assets:prepare": "node prepare.mjs",
          build: "node build.mjs",
        },
      }),
    )
    await writeFixtureFile("apps/web/build.mjs", FIXTURE_BUILD)
    await writeFixtureFile("apps/web/prepare.mjs", FIXTURE_PREPARE)
    for (const path of ROOT_INPUTS)
      await writeFixtureFile(path, "fixture input")
    await rm(join(repositoryRoot, "vendor/presentation-assets/fixture.png"))
    await writeFixtureFile("apps/web/.env.local", "FIXTURE_INPUT=one\n")
    await executeFile("git", ["init", "--quiet", repositoryRoot], {
      windowsHide: true,
    })
  })

  afterEach(async () => {
    await rm(repositoryRoot, { recursive: true, force: true })
  })

  const runTurbo = async (
    key: string | undefined,
    dry: boolean,
  ): Promise<string> => {
    const result = await executeFile(
      process.execPath,
      [
        turboEntry,
        "run",
        "build",
        "--filter=@mapachess/web",
        "--cache=local:rw",
        ...(dry ? ["--dry=json"] : []),
      ],
      {
        cwd: repositoryRoot,
        windowsHide: true,
        timeout: 30_000,
        env: {
          ...process.env,
          CI: "1",
          TURBO_TELEMETRY_DISABLED: "1",
          TURBO_TOKEN: undefined,
          TURBO_TEAM: undefined,
          TURBO_REMOTE_ONLY: undefined,
          GHOST_ASSET_KEY_MAPACHESS: key,
        },
      },
    )
    return result.stdout
  }

  it("hashes private key availability and changes instead of merely passing it through", async () => {
    const fallback = parseWebTask(await runTurbo(undefined, true))
    const firstKey = parseWebTask(await runTurbo(FIXTURE_KEY, true))
    const differentKey = parseWebTask(await runTurbo("B".repeat(43), true))

    expect(
      new Set([fallback.hash, firstKey.hash, differentKey.hash]).size,
    ).toBe(3)
    expect(webTurbo.tasks.build.env).toEqual(["GHOST_ASSET_KEY_MAPACHESS"])
    expect(webTurbo.tasks["assets:prepare"].env).toEqual(
      webTurbo.tasks.build.env,
    )
  }, 30_000)

  it("invalidates the task for encrypted content, preparation code, and ignored local input changes", async () => {
    const initialPlan = await runTurbo(FIXTURE_KEY, true)
    let previous = parseWebTask(initialPlan)
    expect(parseWebTask(initialPlan, "assets:prepare").inputs).toEqual(
      expect.arrayContaining(
        ROOT_INPUTS.filter((path) => !path.startsWith("vendor/"))
          .map((path) => `../../${path}`)
          .concat(".env.local", "build.mjs"),
      ),
    )

    for (const path of [...ROOT_INPUTS, "apps/web/.env.local"]) {
      await writeFixtureFile(path, "changed fixture input")
      const changed = parseWebTask(await runTurbo(FIXTURE_KEY, true))
      expect(changed.hash, path).not.toBe(previous.hash)
      previous = changed
    }
  }, 30_000)

  it("prepares licensed images again while restoring cached application and engine outputs", async () => {
    await runTurbo(FIXTURE_KEY, false)
    for (const path of [
      ".next",
      "public/generated/presentation-assets",
      "public/stockfish-runtime",
    ])
      await rm(join(webRoot, path), { recursive: true })

    await runTurbo(FIXTURE_KEY, false)

    expect(
      await readFile(
        join(webRoot, "public/generated/presentation-assets/fixture.png"),
        "utf8",
      ),
    ).toBe("fixture input")
    expect(
      await readFile(
        join(webRoot, "public/stockfish-runtime/fixture.js"),
        "utf8",
      ),
    ).toBe("fixture runtime")
    expect(await readFile(join(webRoot, ".next/fixture.txt"), "utf8")).toBe(
      "licensed",
    )
    expect(existsSync(join(webRoot, ".next/cache/fixture.txt"))).toBe(false)
    expect(await readFile(join(repositoryRoot, "executions.txt"), "utf8")).toBe(
      "executed\n",
    )
    expect(
      await readFile(join(repositoryRoot, "preparations.txt"), "utf8"),
    ).toBe("prepared\nprepared\n")
  }, 30_000)

  it("fails instead of reusing a licensed cache result when a supplied key is invalid", async () => {
    await runTurbo(FIXTURE_KEY, false)

    await expect(runTurbo("invalid", false)).rejects.toThrow()

    expect(await readFile(join(repositoryRoot, "executions.txt"), "utf8")).toBe(
      "executed\n",
    )
  }, 30_000)

  it("keeps cached application mode consistent across licensed and fallback builds", async () => {
    await runTurbo(FIXTURE_KEY, false)
    await runTurbo(undefined, false)
    expect(
      existsSync(join(webRoot, "public/generated/presentation-assets")),
    ).toBe(false)

    await runTurbo(FIXTURE_KEY, false)
    expect(
      existsSync(
        join(webRoot, "public/generated/presentation-assets/fixture.png"),
      ),
    ).toBe(true)
    expect(await readFile(join(webRoot, ".next/fixture.txt"), "utf8")).toBe(
      "licensed",
    )

    await runTurbo(undefined, false)
    expect(await readFile(join(webRoot, ".next/fixture.txt"), "utf8")).toBe(
      "fallback",
    )
    expect(
      existsSync(
        join(webRoot, "public/generated/presentation-assets/fixture.png"),
      ),
    ).toBe(false)
    expect(await readFile(join(repositoryRoot, "executions.txt"), "utf8")).toBe(
      "executed\nexecuted\n",
    )
    expect(
      await readFile(join(repositoryRoot, "preparations.txt"), "utf8"),
    ).toBe("prepared\nprepared\nprepared\nprepared\n")
  }, 30_000)
})

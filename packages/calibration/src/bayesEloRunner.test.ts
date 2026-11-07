import { ChildProcess, spawn } from "node:child_process"
import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"
import { standardPlanFixture } from "../test/calibrationFixtures"
import { BAYES_ELO_EXECUTABLE_IDENTITY } from "./bayesEloIdentity"
import createBayesEloInput, { type BayesEloPolicyAlias } from "./bayesEloInput"
import type { BayesEloBridgeOffset } from "./bayesEloRatingEvidence"
import runBayesElo, {
  BayesEloExecutionAbortedError,
  createBayesEloCommands,
  type RunBayesEloInput,
} from "./bayesEloRunner"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch"

vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof import("node:child_process")>()),
  spawn: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

async function ratingInput(
  onTestFinished: (cleanup: () => Promise<void>) => void,
): Promise<RunBayesEloInput> {
  const rootDirectory = await mkdtemp(
    join(tmpdir(), "mapachess-rating-process-test-"),
  )
  onTestFinished(() => rm(rootDirectory, { recursive: true, force: true }))
  const plan = standardPlanFixture()
  await executeCalibrationSmokeBatch({
    rootDirectory,
    plan,
    maxPlies: 10,
    maximumNewGames: 2,
    openEngine: () => {
      throw new Error("Terminal positions must not open an engine.")
    },
  })
  const input = await createBayesEloInput({ rootDirectory, plan, maxPlies: 10 })
  const anchor = input.policyAliases[0]
  if (anchor === undefined) throw new Error("The fixture requires an anchor.")
  return {
    input,
    anchor: { elo: 1320, policyFingerprint: anchor.policyFingerprint },
    provisioned: {
      executablePath: "controlled-bayeselo",
      identity: BAYES_ELO_EXECUTABLE_IDENTITY,
    },
  }
}

function childFixture() {
  const child = new ChildProcess()
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  Object.defineProperties(child, {
    stdin: { value: stdin },
    stdout: { value: stdout },
    stderr: { value: stderr },
  })
  const kill = vi.spyOn(child, "kill").mockImplementation(() => {
    queueMicrotask(() => child.emit("close", null))
    return true
  })
  vi.mocked(spawn).mockReturnValue(child)
  return { child, stdin, stdout, stderr, kill }
}

function successfulOutput(input: RunBayesEloInput): string {
  const [first, second] = input.input.policyAliases
  if (first === undefined || second === undefined)
    throw new Error("Two policies are required.")
  return `version 0056, Copyright (C) 1997-2007 Remi Coulom.
Rank Name Elo + - games score oppo. draws
1 ${first.alias} 1320 100 90 2 50% 1320 100%
2 ${second.alias} 1320 90 100 2 50% 1320 100%
      ${first.alias} ${second.alias}
${first.alias}      5000
${second.alias} 4999
ResultSet>`
}

describe("BayesElo runner", () => {
  it("writes real PGN, sends the complete command sequence, validates evidence, and removes its working directory", async ({
    onTestFinished,
  }) => {
    const input = await ratingInput(onTestFinished)
    const process = childFixture()
    let commands = ""
    process.stdin.on("data", (chunk: Buffer) => {
      commands += chunk.toString()
    })
    const result = runBayesElo(input)
    await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce())
    const directory = String(vi.mocked(spawn).mock.calls[0]?.[2]?.cwd)
    expect(await readFile(join(directory, "input.pgn"), "utf8")).toBe(
      input.input.pgn,
    )
    expect(commands).toContain("offset 1320 P001\nratings\nlos 0 2 5\nx\nx\n")
    process.stdout.write(Buffer.from(successfulOutput(input)))
    process.stderr.write(
      Buffer.from("2 game(s) loaded, 0 game(s) with unknown result ignored.\n"),
    )
    process.child.emit("close", 0)
    const evidence = await result
    expect(evidence.completedPairCount).toBe(1)
    expect(evidence.ratings.map(({ estimateElo }) => estimateElo)).toEqual([
      1320, 1320,
    ])
    await expect(access(directory)).rejects.toMatchObject({ code: "ENOENT" })
  })

  it.each([null, 7])(
    "rejects process exit %s without accepting ratings and cleans up",
    async (code) => {
      const input = await ratingInput(onTestFinished)
      const process = childFixture()
      const result = runBayesElo(input)
      const failed = expect(result).rejects.toThrow(
        `BayesElo exited with code ${code ?? "none"}`,
      )
      await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
      const directory = String(vi.mocked(spawn).mock.calls[0]?.[2]?.cwd)
      process.child.emit("close", code)
      await failed
      await expect(access(directory)).rejects.toMatchObject({ code: "ENOENT" })
    },
  )

  it("rejects launch errors once even when a close event follows", async ({
    onTestFinished,
  }) => {
    const input = await ratingInput(onTestFinished)
    const process = childFixture()
    const result = runBayesElo(input)
    const failed = expect(result).rejects.toThrow("Process unavailable")
    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    process.child.emit("error", new Error("Process unavailable"))
    process.child.emit("close", 0)
    await failed
  })

  it.each(["before", "during"] as const)(
    "honors abort %s process startup",
    async (when) => {
      const input = await ratingInput(onTestFinished)
      const process = childFixture()
      const controller = new AbortController()
      if (when === "before") controller.abort()
      const result = runBayesElo({ ...input, signal: controller.signal })
      const failed = expect(result).rejects.toBeInstanceOf(
        BayesEloExecutionAbortedError,
      )
      if (when === "during") {
        await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
        controller.abort()
        expect(process.kill).toHaveBeenCalledOnce()
      }
      await failed
      if (when === "before") expect(spawn).not.toHaveBeenCalled()
    },
  )

  it("terminates excessive combined process output instead of retaining unbounded text", async ({
    onTestFinished,
  }) => {
    const input = await ratingInput(onTestFinished)
    const process = childFixture()
    const result = runBayesElo(input)
    const failed = expect(result).rejects.toThrow("exceeded 16 MiB")
    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    process.stdout.write(Buffer.alloc(8 * 1024 * 1024, "a"))
    process.stderr.write(Buffer.alloc(8 * 1024 * 1024 + 1, "b"))
    await failed
    expect(process.kill).toHaveBeenCalledOnce()
  })

  it("rejects unrateable evidence and invalid anchors before launching a process", async ({
    onTestFinished,
  }) => {
    const input = await ratingInput(onTestFinished)
    childFixture()
    for (const elo of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      await expect(
        runBayesElo({ ...input, anchor: { ...input.anchor, elo } }),
      ).rejects.toThrow("positive safe integer")
    await expect(
      runBayesElo({
        ...input,
        input: { ...input.input, completedPairCount: 0 },
      }),
    ).rejects.toThrow("completed pair")
    await expect(
      runBayesElo({ ...input, input: { ...input.input, policyAliases: [] } }),
    ).rejects.toThrow("not present in the plan")
    await expect(
      runBayesElo({ ...input, input: { ...input.input, pgn: "" } }),
    ).rejects.toThrow("no completed-pair evidence")
    expect(() =>
      createBayesEloCommands([], {
        alias: "P001",
        anchorElo: 1320,
        policyFingerprint: input.anchor.policyFingerprint,
      }),
    ).toThrow("at least two policies")
    expect(spawn).not.toHaveBeenCalled()
  })

  it("widens the rating integration range while preserving three-Elo grid spacing", () => {
    const policy = standardPlanFixture().policies[0]
    if (policy === undefined) {
      throw new Error("BayesElo command fixture policy is missing.")
    }
    const bridgeOffset: BayesEloBridgeOffset = {
      anchorElo: 1320,
      alias: "P001",
      policyFingerprint: policy.fingerprint,
    }

    expect(
      createBayesEloCommands(
        ["P001", "P002"] satisfies readonly BayesEloPolicyAlias[],
        bridgeOffset,
      ),
    ).toEqual([
      "readpgn input.pgn",
      "elo",
      "mm",
      "minelo -4500",
      "maxelo 4500",
      "resolution 3001",
      "exactdist",
      "offset 1320 P001",
      "ratings",
      "los 0 2 5",
      "x",
      "x",
    ])
  })
})

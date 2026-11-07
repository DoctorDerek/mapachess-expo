import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest"
import { STOCKFISH_18_BUILD_IDENTITY } from "@mapachess/stockfish/build-identity"
import type {
  StockfishEngineSession,
  StockfishEngineSessionState,
} from "@mapachess/stockfish/engine-session"
import {
  chess960PlanFixture,
  MATE_IN_ONE_FEN,
  STALEMATE_FEN,
  standardPlanFixture,
  standardPolicyFixture,
} from "../test/calibrationFixtures"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
  type CalibrationPlan,
} from "./calibrationPlan"

const command = vi.hoisted(() => {
  const plans: {
    standard: CalibrationPlan | null
    chess960: CalibrationPlan | null
    candidate: CalibrationPlan | null
  } = { standard: null, chess960: null, candidate: null }
  return { plans, provision: vi.fn(), openEngine: vi.fn() }
})
vi.mock("./standardCalibrationSmokePlan.js", async (original) => ({
  ...(await original<typeof import("./standardCalibrationSmokePlan")>()),
  get default() {
    return command.plans.standard
  },
}))
vi.mock("./chess960CalibrationSmokePlan.js", async (original) => ({
  ...(await original<typeof import("./chess960CalibrationSmokePlan")>()),
  get default() {
    return command.plans.chess960
  },
}))
vi.mock("./standardChickenCandidatePlan.js", async (original) => ({
  ...(await original<typeof import("./standardChickenCandidatePlan")>()),
  get default() {
    return command.plans.candidate
  },
}))
vi.mock("@mapachess/stockfish/provision", async (original) => ({
  ...(await original<typeof import("@mapachess/stockfish/provision")>()),
  default: command.provision,
}))
vi.mock("@mapachess/stockfish/uci-process-adapter", async (original) => ({
  ...(await original<
    typeof import("@mapachess/stockfish/uci-process-adapter")
  >()),
  createProvisionedStockfishProcessAdapter: command.openEngine,
}))

const originalArguments = process.argv
const originalExitCode = process.exitCode
beforeEach(() => {
  vi.clearAllMocks()
  process.exitCode = undefined
  command.plans.standard = standardPlanFixture(MATE_IN_ONE_FEN)
  command.plans.chess960 = chess960PlanFixture(STALEMATE_FEN)
  command.plans.candidate = createCalibrationPlan({
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    seed: 42,
    variant: "standard",
    openings: [{ id: "terminal", fen: STALEMATE_FEN }],
    edges: [
      {
        id: "a",
        pairsPerOpening: 1,
        policyA: standardPolicyFixture(1000),
        policyB: standardPolicyFixture(2000),
      },
      {
        id: "b",
        pairsPerOpening: 1,
        policyA: standardPolicyFixture(2000),
        policyB: standardPolicyFixture(3000),
      },
    ],
  })
  command.provision.mockResolvedValue({
    executablePath: "not-executed",
    identity: STOCKFISH_18_BUILD_IDENTITY,
    installDirectory: "controlled",
    target: "windows-x64",
  })
  command.openEngine.mockImplementation(() => {
    let state: StockfishEngineSessionState = "created"
    return {
      async boot() {
        state = "ready"
        return { name: "Controlled Stockfish", author: "Test fixture" }
      },
      async search(request) {
        return { requestId: request.requestId, bestMove: "g6g7" }
      },
      async close() {
        state = "closed"
      },
      state: () => state,
    } satisfies StockfishEngineSession
  })
})
afterEach(() => {
  process.argv = originalArguments
  process.exitCode = originalExitCode
  vi.restoreAllMocks()
})

async function runCommand(
  kind: "smoke" | "candidate",
  args: readonly string[],
) {
  const workspace = await mkdtemp(join(tmpdir(), "mapachess-command-test-"))
  onTestFinished(() => rm(workspace, { recursive: true, force: true }))
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true)
  const stderr = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true)
  const listenersBefore = process.listenerCount("SIGINT")
  process.argv = [
    process.execPath,
    "calibration-command",
    ...args,
    "--workspace-root",
    workspace,
    "--evidence-root",
    "evidence",
  ]
  vi.resetModules()
  if (kind === "smoke") await import("./calibrationSmokeCli")
  else await import("./standardChickenCandidateCli")
  expect(process.listenerCount("SIGINT")).toBe(listenersBefore)
  return {
    workspace,
    stdout: stdout.mock.calls.map(([chunk]) => String(chunk)).join(""),
    stderr: stderr.mock.calls.map(([chunk]) => String(chunk)).join(""),
  }
}

describe("calibration command composition and evidence preservation", () => {
  it.each(["standard", "chess960"] as const)(
    "runs the %s smoke command through real rules, persistence, and summarization",
    async (variant) => {
      const result = await runCommand("smoke", [
        "--variant",
        variant,
        "--max-plies",
        "2",
      ])
      expect(result.stderr).toBe("")
      expect(process.exitCode).toBeUndefined()
      expect(JSON.parse(result.stdout)).toMatchObject({
        evidenceRoot: join(result.workspace, "evidence"),
        summary: {
          completedGameCount: 2,
          scoredPairCount: 1,
          connectivity: { isConnected: true },
        },
      })
      if (variant === "standard") {
        expect(command.provision).toHaveBeenCalledOnce()
        expect(command.openEngine).toHaveBeenCalled()
      } else expect(command.provision).not.toHaveBeenCalled()
    },
  )

  it.each([
    ["--variant", "invalid"],
    ["--max-plies", "0"],
    ["--maximum-new-games", "1.5"],
    ["--max-plies", "9007199254740992"],
    ["--unknown", "x"],
  ])(
    "reports invalid smoke arguments %j without running engines",
    async (...args) => {
      const result = await runCommand("smoke", args)
      expect(result.stderr).toContain("Calibration smoke command failed:")
      expect(result.stdout).toBe("")
      expect(process.exitCode).toBe(1)
      expect(command.provision).not.toHaveBeenCalled()
    },
  )

  it("writes a candidate report and complete-pair PGN while withholding ratings from disconnected evidence", async () => {
    const result = await runCommand("candidate", [
      "--",
      "--maximum-new-pairs",
      "1",
    ])
    expect(result.stderr).toBe("")
    expect(process.exitCode).toBeUndefined()
    const summary: {
      artifacts: { reportPath: string; completedPairsPath: string }
    } = JSON.parse(result.stdout)
    const report: {
      ratingEvidence: unknown
      summary: {
        scoredPairCount: number
        connectivity: { isConnected: boolean }
      }
      bayesEloInput: { pgn?: unknown; completedPairCount: number }
    } = JSON.parse(await readFile(summary.artifacts.reportPath, "utf8"))
    expect(report.ratingEvidence).toBeNull()
    expect(report.summary).toMatchObject({
      scoredPairCount: 1,
      connectivity: { isConnected: false },
    })
    expect(report.bayesEloInput).not.toHaveProperty("pgn")
    expect(report.bayesEloInput.completedPairCount).toBe(1)
    expect(
      await readFile(summary.artifacts.completedPairsPath, "utf8"),
    ).toContain('[Result "1/2-1/2"]')
  })

  it.each([
    ["--variant", "invalid"],
    ["--profile", "invalid"],
    ["--variant", "chess960"],
    ["--maximum-new-pairs", "0"],
    ["--maximum-new-pairs", "9007199254740992"],
    ["--maximum-new-pairs", "9007199254740991"],
  ])(
    "reports invalid candidate arguments %j without launching calibration",
    async (...args) => {
      const result = await runCommand("candidate", args)
      expect(result.stderr).toContain("Calibration candidate command failed:")
      expect(result.stdout).toBe("")
      expect(process.exitCode).toBe(1)
      expect(command.provision).not.toHaveBeenCalled()
    },
  )

  it.each(["web-low-elo", "web-weak-end", "web-ladder"])(
    "requires existing executable prerequisites for %s instead of downloading silently",
    async (profile) => {
      const result = await runCommand("candidate", ["--profile", profile])
      expect(result.stderr).toContain("ENOENT")
      expect(result.stdout).toBe("")
      expect(process.exitCode).toBe(1)
      expect(command.provision).not.toHaveBeenCalled()
    },
  )

  it("retains an engine startup failure as a command diagnostic and removes the interrupt listener", async () => {
    command.provision.mockRejectedValueOnce(new Error("Executable unavailable"))
    const result = await runCommand("smoke", [])
    expect(result.stderr).toContain("Executable unavailable")
    expect(result.stdout).toBe("")
    expect(process.exitCode).toBe(1)
  })
})

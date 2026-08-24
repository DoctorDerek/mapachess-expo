import { resolve } from "node:path"
import { parseArgs } from "node:util"
import provisionStockfish18, {
  type ProvisionedStockfish,
} from "@mapachess/stockfish/provision"
import { createProvisionedStockfishProcessAdapter } from "@mapachess/stockfish/uci-process-adapter"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch.js"
import summarizeCalibrationSmokeEvidence from "./calibrationSmokeSummary.js"
import standardCalibrationSmokePlan from "./standardCalibrationSmokePlan.js"

const DEFAULT_MAXIMUM_NEW_GAMES = 2
const DEFAULT_MAX_PLIES = 200
const DEFAULT_WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..")

function positiveSafeInteger(value: string, label: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }

  return parsed
}

async function runCalibrationSmokeCommand(): Promise<void> {
  const { values } = parseArgs({
    allowPositionals: false,
    strict: true,
    options: {
      "evidence-root": { type: "string" },
      "maximum-new-games": {
        type: "string",
        default: String(DEFAULT_MAXIMUM_NEW_GAMES),
      },
      "max-plies": {
        type: "string",
        default: String(DEFAULT_MAX_PLIES),
      },
      "workspace-root": {
        type: "string",
        default: DEFAULT_WORKSPACE_ROOT,
      },
    },
  })
  const workspaceRoot = resolve(values["workspace-root"])
  const evidenceRoot = resolve(
    workspaceRoot,
    values["evidence-root"] ?? ".calibration/standard-smoke",
  )
  const maximumNewGames = positiveSafeInteger(
    values["maximum-new-games"],
    "maximum-new-games",
  )
  const maxPlies = positiveSafeInteger(values["max-plies"], "max-plies")
  const abortController = new AbortController()
  const abortBatch = () => abortController.abort()
  let provisionedStockfish: Promise<ProvisionedStockfish> | undefined
  process.once("SIGINT", abortBatch)

  try {
    const batch = await executeCalibrationSmokeBatch({
      rootDirectory: evidenceRoot,
      plan: standardCalibrationSmokePlan,
      maxPlies,
      maximumNewGames,
      signal: abortController.signal,
      openEngine: async ({ configuration }) => {
        provisionedStockfish ??= provisionStockfish18(workspaceRoot)
        return createProvisionedStockfishProcessAdapter(
          await provisionedStockfish,
          configuration,
        )
      },
    })
    const summary = await summarizeCalibrationSmokeEvidence({
      rootDirectory: evidenceRoot,
      plan: standardCalibrationSmokePlan,
      maxPlies,
    })
    process.stdout.write(
      `${JSON.stringify({ evidenceRoot, batch, summary }, null, 2)}\n`,
    )
  } finally {
    process.removeListener("SIGINT", abortBatch)
  }
}

try {
  await runCalibrationSmokeCommand()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Calibration smoke command failed: ${message}\n`)
  process.exitCode = 1
}

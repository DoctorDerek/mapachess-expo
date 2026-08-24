import { mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import provisionStockfish18, {
  type ProvisionedStockfish,
} from "@mapachess/stockfish/provision"
import { createProvisionedStockfishProcessAdapter } from "@mapachess/stockfish/uci-process-adapter"
import createBayesEloInput from "./bayesEloInput.js"
import provisionBayesElo from "./bayesEloProvision.js"
import runBayesElo from "./bayesEloRunner.js"
import { resolveCalibrationEvidencePaths } from "./calibrationEvidenceStore.js"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch.js"
import summarizeCalibrationSmokeEvidence from "./calibrationSmokeSummary.js"
import standardChickenCandidatePlan, {
  STANDARD_CHICKEN_ANCHOR,
  STANDARD_CHICKEN_MAX_PLIES,
} from "./standardChickenCandidatePlan.js"
import createStandardChickenShortlist from "./standardChickenShortlist.js"

const CANDIDATE_REPORT_SCHEMA_VERSION = 1 as const
const COMPLETED_PAIRS_FILE_NAME = "completed-pairs.pgn"
const DEFAULT_MAXIMUM_NEW_PAIRS = 1
const DEFAULT_WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..")
const REPORT_FILE_NAME = "candidate-report.json"

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

function gamesForPairs(pairCount: number): number {
  const gameCount = pairCount * 2
  if (!Number.isSafeInteger(gameCount)) {
    throw new TypeError("maximum-new-pairs is too large.")
  }

  return gameCount
}

async function runStandardChickenCandidateCommand(): Promise<void> {
  const processArguments = process.argv.slice(2)
  const { values } = parseArgs({
    args:
      processArguments[0] === "--"
        ? processArguments.slice(1)
        : processArguments,
    allowPositionals: false,
    strict: true,
    options: {
      "evidence-root": { type: "string" },
      "maximum-new-pairs": {
        type: "string",
        default: String(DEFAULT_MAXIMUM_NEW_PAIRS),
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
    values["evidence-root"] ?? ".calibration/standard-chicken-candidates",
  )
  const maximumNewPairs = positiveSafeInteger(
    values["maximum-new-pairs"],
    "maximum-new-pairs",
  )
  const abortController = new AbortController()
  const abortCommand = () => abortController.abort()
  let provisionedStockfish: Promise<ProvisionedStockfish> | undefined
  process.once("SIGINT", abortCommand)

  try {
    const batch = await executeCalibrationSmokeBatch({
      rootDirectory: evidenceRoot,
      plan: standardChickenCandidatePlan,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
      maximumNewGames: gamesForPairs(maximumNewPairs),
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
      plan: standardChickenCandidatePlan,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
    })
    const bayesEloInput = await createBayesEloInput({
      rootDirectory: evidenceRoot,
      plan: standardChickenCandidatePlan,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
    })
    const ratingEvidence =
      bayesEloInput.completedPairCount === 0 ||
      !summary.connectivity.isConnected
        ? null
        : await runBayesElo({
            input: bayesEloInput,
            anchor: STANDARD_CHICKEN_ANCHOR,
            provisioned: await provisionBayesElo(workspaceRoot),
            signal: abortController.signal,
          })
    const shortlist = createStandardChickenShortlist({
      summary,
      ratings: ratingEvidence?.ratings ?? [],
    })
    const [firstGame] = standardChickenCandidatePlan.games
    if (firstGame === undefined) {
      throw new Error("Standard Chicken candidate plan has no games.")
    }
    const artifactDirectory = join(
      resolveCalibrationEvidencePaths(
        evidenceRoot,
        standardChickenCandidatePlan,
        firstGame,
      ).planDirectory,
      "candidate-sweep",
    )
    const completedPairsPath = join(
      artifactDirectory,
      COMPLETED_PAIRS_FILE_NAME,
    )
    const reportPath = join(artifactDirectory, REPORT_FILE_NAME)
    const { pgn, ...bayesEloInputEvidence } = bayesEloInput
    const report = {
      schemaVersion: CANDIDATE_REPORT_SCHEMA_VERSION,
      planId: standardChickenCandidatePlan.planId,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
      maximumNewPairs,
      batch,
      summary,
      bayesEloInput: bayesEloInputEvidence,
      ratingEvidence,
      shortlist,
    }

    await mkdir(artifactDirectory, { recursive: true })
    await writeFile(completedPairsPath, pgn, "utf8")
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    process.stdout.write(
      `${JSON.stringify(
        {
          evidenceRoot,
          artifacts: { completedPairsPath, reportPath },
          planId: standardChickenCandidatePlan.planId,
          batch: {
            executedGameCount: batch.executedGameIds.length,
            previouslyStoredGameCount: batch.previouslyStoredGameIds.length,
            remainingGameCount: batch.remainingGameIds.length,
          },
          evidence: {
            storedGameCount: summary.storedGameCount,
            completedGameCount: summary.completedGameCount,
            unterminatedGameCount: summary.unterminatedGameCount,
            scoredPairCount: summary.scoredPairCount,
            isConnected: summary.connectivity.isConnected,
          },
          rating: {
            completedPairCount: bayesEloInput.completedPairCount,
            excludedPairCount: bayesEloInput.excludedPairCount,
          },
          shortlist,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    process.removeListener("SIGINT", abortCommand)
  }
}

try {
  await runStandardChickenCandidateCommand()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(
    `Standard Chicken candidate command failed: ${message}\n`,
  )
  process.exitCode = 1
}

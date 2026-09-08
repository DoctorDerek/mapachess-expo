import { access, mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import provisionStockfish18, {
  resolveStockfishInstallPaths,
  type ProvisionedStockfish,
} from "@mapachess/stockfish/provision"
import { createProvisionedStockfishProcessAdapter } from "@mapachess/stockfish/uci-process-adapter"
import createBayesEloInput from "./bayesEloInput.js"
import provisionBayesElo, {
  resolveBayesEloInstallPaths,
} from "./bayesEloProvision.js"
import runBayesElo from "./bayesEloRunner.js"
import { resolveCalibrationEvidencePaths } from "./calibrationEvidenceStore.js"
import executeCalibrationSmokeBatch from "./calibrationSmokeBatch.js"
import summarizeCalibrationSmokeEvidence from "./calibrationSmokeSummary.js"
import fingerprintOpponentPolicy from "./opponentPolicy.js"
import standardChickenCandidatePlan, {
  STANDARD_CHICKEN_ANCHOR,
  STANDARD_CHICKEN_DEFAULT_EVIDENCE_ROOT,
  STANDARD_CHICKEN_MAX_PLIES,
} from "./standardChickenCandidatePlan.js"
import createStandardChickenShortlist from "./standardChickenShortlist.js"
import createWebOpponentCandidatePlan from "./webOpponentCandidatePlan.js"
import openWebStockfishCalibrationSession from "./webStockfishCalibrationSession.js"

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

async function runCandidateCalibrationCommand(): Promise<void> {
  const processArguments = process.argv.slice(2)
  const { values } = parseArgs({
    args:
      processArguments[0] === "--"
        ? processArguments.slice(1)
        : processArguments,
    allowPositionals: false,
    strict: true,
    options: {
      profile: { type: "string", default: "standard-chicken" },
      variant: { type: "string", default: "standard" },
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
  const variant = values.variant
  if (variant !== "standard" && variant !== "chess960") {
    throw new TypeError("variant must be standard or chess960.")
  }
  if (
    values.profile !== "standard-chicken" &&
    values.profile !== "web-low-elo"
  ) {
    throw new TypeError("profile must be standard-chicken or web-low-elo.")
  }
  if (values.profile === "standard-chicken" && variant !== "standard") {
    throw new TypeError(
      "The historical Chicken experiment supports Standard only; use the web-low-elo profile for Chess960.",
    )
  }
  const webExperiment =
    values.profile === "web-low-elo"
      ? createWebOpponentCandidatePlan(variant)
      : undefined
  const plan = webExperiment?.plan ?? standardChickenCandidatePlan
  const anchor = webExperiment?.anchor ?? STANDARD_CHICKEN_ANCHOR
  const workspaceRoot = resolve(values["workspace-root"])
  if (webExperiment !== undefined) {
    await access(resolveStockfishInstallPaths(workspaceRoot).executablePath)
    await access(resolveBayesEloInstallPaths(workspaceRoot).executablePath)
  }
  const evidenceRoot = resolve(
    workspaceRoot,
    values["evidence-root"] ??
      (webExperiment === undefined
        ? STANDARD_CHICKEN_DEFAULT_EVIDENCE_ROOT
        : `.calibration/web-low-strength-${variant}-${String(STANDARD_CHICKEN_MAX_PLIES)}-plies`),
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
      plan,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
      maximumNewGames: gamesForPairs(maximumNewPairs),
      signal: abortController.signal,
      openEngine: async ({ configuration, policy }) => {
        if ("kind" in policy.engine) {
          return openWebStockfishCalibrationSession(
            workspaceRoot,
            configuration,
          )
        }
        provisionedStockfish ??= provisionStockfish18(workspaceRoot)
        const provisioned = await provisionedStockfish
        if (
          fingerprintOpponentPolicy(policy) !==
          fingerprintOpponentPolicy({ ...policy, engine: provisioned.identity })
        ) {
          throw new Error(
            "The calibration reference engine does not match its recorded policy.",
          )
        }
        return createProvisionedStockfishProcessAdapter(
          provisioned,
          configuration,
        )
      },
    })
    const summary = await summarizeCalibrationSmokeEvidence({
      rootDirectory: evidenceRoot,
      plan,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
    })
    const bayesEloInput = await createBayesEloInput({
      rootDirectory: evidenceRoot,
      plan,
      maxPlies: STANDARD_CHICKEN_MAX_PLIES,
    })
    const ratingEvidence =
      bayesEloInput.completedPairCount === 0 ||
      !summary.connectivity.isConnected
        ? null
        : await runBayesElo({
            input: bayesEloInput,
            anchor,
            provisioned: await provisionBayesElo(workspaceRoot),
            signal: abortController.signal,
          })
    const shortlist =
      webExperiment === undefined
        ? createStandardChickenShortlist({
            summary,
            ratings: ratingEvidence?.ratings ?? [],
          })
        : null
    const [firstGame] = plan.games
    if (firstGame === undefined) {
      throw new Error("The calibration candidate plan has no games.")
    }
    const artifactDirectory = join(
      resolveCalibrationEvidencePaths(evidenceRoot, plan, firstGame)
        .planDirectory,
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
      planId: plan.planId,
      ...(webExperiment === undefined
        ? {}
        : {
            profile: values.profile,
            execution: {
              node: process.versions.node,
              platform: process.platform,
              architecture: process.arch,
            },
          }),
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
          planId: plan.planId,
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
  await runCandidateCalibrationCommand()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Calibration candidate command failed: ${message}\n`)
  process.exitCode = 1
}

import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { BayesEloInput, BayesEloPolicyAlias } from "./bayesEloInput.js"
import type { ProvisionedBayesElo } from "./bayesEloProvision.js"
import parseBayesEloRatingEvidence, {
  type BayesEloBridgeOffset,
  type BayesEloRatingEvidence,
} from "./bayesEloRatingEvidence.js"
import type { OpponentPolicyFingerprint } from "./opponentPolicy.js"

const BAYES_ELO_INPUT_FILE_NAME = "input.pgn"
const MAX_PROCESS_OUTPUT_BYTES = 16 * 1024 * 1024

export type RunBayesEloInput = Readonly<{
  anchor: Readonly<{
    elo: number
    policyFingerprint: OpponentPolicyFingerprint
  }>
  input: BayesEloInput
  provisioned: ProvisionedBayesElo
  signal?: AbortSignal
}>

type BayesEloProcessResult = Readonly<{
  stderr: string
  stdout: string
}>

export class BayesEloExecutionAbortedError extends Error {
  public constructor() {
    super("BayesElo rating execution was aborted.")
    this.name = "BayesEloExecutionAbortedError"
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

export function createBayesEloCommands(
  aliases: readonly BayesEloPolicyAlias[],
  bridgeOffset: BayesEloBridgeOffset,
): readonly string[] {
  if (aliases.length < 2) {
    throw new TypeError("BayesElo commands require at least two policies.")
  }
  const aliasWidth = Math.max(...aliases.map((alias) => alias.length)) + 1

  return [
    `readpgn ${BAYES_ELO_INPUT_FILE_NAME}`,
    "elo",
    "mm",
    "exactdist",
    `offset ${bridgeOffset.anchorElo} ${bridgeOffset.alias}`,
    "ratings",
    `los 0 ${aliases.length} ${aliasWidth}`,
    "x",
    "x",
  ]
}

function executeBayesEloProcess(
  executablePath: string,
  workingDirectory: string,
  commands: readonly string[],
  signal: AbortSignal | undefined,
): Promise<BayesEloProcessResult> {
  if (signal?.aborted === true) {
    return Promise.reject(new BayesEloExecutionAbortedError())
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, [], {
      cwd: workingDirectory,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    let outputError: Error | undefined
    let settled = false

    const removeAbortListener = () =>
      signal?.removeEventListener("abort", abort)
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      removeAbortListener()
      reject(error)
    }
    const appendOutput = (stream: "stderr" | "stdout", chunk: Buffer) => {
      const text = chunk.toString("utf8")
      if (stream === "stdout") stdout += text
      else stderr += text

      if (
        Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(stderr, "utf8") >
        MAX_PROCESS_OUTPUT_BYTES
      ) {
        outputError = new Error("BayesElo process output exceeded 16 MiB.")
        child.kill()
      }
    }
    function abort(): void {
      child.kill()
    }

    child.stdout.on("data", (chunk: Buffer) => appendOutput("stdout", chunk))
    child.stderr.on("data", (chunk: Buffer) => appendOutput("stderr", chunk))
    child.once("error", fail)
    child.once("close", (exitCode) => {
      if (settled) return
      settled = true
      removeAbortListener()
      if (signal?.aborted === true) {
        reject(new BayesEloExecutionAbortedError())
        return
      }
      if (outputError !== undefined) {
        reject(outputError)
        return
      }
      if (exitCode !== 0) {
        reject(new Error(`BayesElo exited with code ${exitCode ?? "none"}.`))
        return
      }

      resolve({ stdout, stderr })
    })
    signal?.addEventListener("abort", abort, { once: true })
    child.stdin.end(`${commands.join("\n")}\n`)
  })
}

function requireBridgeOffset(input: RunBayesEloInput): BayesEloBridgeOffset {
  assertPositiveSafeInteger(input.anchor.elo, "anchor Elo")
  const aliasRecord = input.input.policyAliases.find(
    ({ policyFingerprint }) =>
      policyFingerprint === input.anchor.policyFingerprint,
  )
  if (aliasRecord === undefined) {
    throw new TypeError("BayesElo bridge policy is not present in the plan.")
  }
  if (
    !input.input.pgn.includes(`[White "${aliasRecord.alias}"]`) &&
    !input.input.pgn.includes(`[Black "${aliasRecord.alias}"]`)
  ) {
    throw new TypeError(
      "BayesElo bridge policy has no completed-pair evidence.",
    )
  }

  return {
    alias: aliasRecord.alias,
    policyFingerprint: aliasRecord.policyFingerprint,
    anchorElo: input.anchor.elo,
  }
}

export default async function runBayesElo(
  input: RunBayesEloInput,
): Promise<BayesEloRatingEvidence> {
  if (input.input.completedPairCount === 0) {
    throw new TypeError("BayesElo requires at least one completed pair.")
  }

  const bridgeOffset = requireBridgeOffset(input)
  const commands = createBayesEloCommands(
    input.input.policyAliases.map(({ alias }) => alias),
    bridgeOffset,
  )
  const workingDirectory = await mkdtemp(
    join(tmpdir(), "mapachess-bayeselo-rating-"),
  )

  try {
    await writeFile(
      join(workingDirectory, BAYES_ELO_INPUT_FILE_NAME),
      input.input.pgn,
      "utf8",
    )
    const processResult = await executeBayesEloProcess(
      input.provisioned.executablePath,
      workingDirectory,
      commands,
      input.signal,
    )
    return parseBayesEloRatingEvidence({
      input: input.input,
      bridgeOffset,
      ...processResult,
    })
  } finally {
    await rm(workingDirectory, { force: true, recursive: true })
  }
}

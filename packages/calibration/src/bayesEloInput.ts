import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Chess } from "chess.js"
import { loadStoredCalibrationGame } from "./calibrationEvidenceStore.js"
import type { CalibrationGame, CalibrationPlan } from "./calibrationPlan.js"
import listCalibrationPlanPairs from "./calibrationPlanPairs.js"
import type { OpponentPolicyFingerprint } from "./opponentPolicy.js"

export const BAYES_ELO_INPUT_SCHEMA_VERSION = 1 as const

declare const bayesEloInputSha256Brand: unique symbol

export type BayesEloInputSha256 = string & {
  readonly [bayesEloInputSha256Brand]: true
}
export type BayesEloPolicyAlias = `P${string}`

export type BayesEloPolicyAliasRecord = Readonly<{
  alias: BayesEloPolicyAlias
  policyFingerprint: OpponentPolicyFingerprint
}>

export type BayesEloInput = Readonly<{
  schemaVersion: typeof BAYES_ELO_INPUT_SCHEMA_VERSION
  completedGameCount: number
  completedPairCount: number
  completedPairIds: readonly CalibrationGame["pairId"][]
  excludedPairCount: number
  inputSha256: BayesEloInputSha256
  maxPlies: number
  pgn: string
  pgnSha256: BayesEloInputSha256
  planId: CalibrationPlan["planId"]
  policyAliases: readonly BayesEloPolicyAliasRecord[]
  scheduledPairCount: number
  variant: "standard"
}>

export type CreateBayesEloInputInput = Readonly<{
  maxPlies: number
  plan: CalibrationPlan
  rootDirectory: string
}>

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function compareText(left: string, right: string): number {
  return Number(left > right) - Number(left < right)
}

function sha256Text(value: string): BayesEloInputSha256 {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex") as BayesEloInputSha256
}

function createPolicyAliases(
  plan: CalibrationPlan,
): readonly BayesEloPolicyAliasRecord[] {
  return plan.policies
    .toSorted((left, right) => compareText(left.fingerprint, right.fingerprint))
    .map(({ fingerprint }, index) => ({
      alias: `P${String(index + 1).padStart(3, "0")}`,
      policyFingerprint: fingerprint,
    }))
}

function requireAlias(
  aliases: ReadonlyMap<OpponentPolicyFingerprint, BayesEloPolicyAlias>,
  fingerprint: OpponentPolicyFingerprint,
): BayesEloPolicyAlias {
  const alias = aliases.get(fingerprint)
  if (alias === undefined) {
    throw new Error(`BayesElo alias is missing for ${fingerprint}.`)
  }

  return alias
}

function rewritePgnPlayerNames(
  pgn: string,
  game: CalibrationGame,
  aliases: ReadonlyMap<OpponentPolicyFingerprint, BayesEloPolicyAlias>,
): string {
  const chess = new Chess()
  chess.loadPgn(pgn, { strict: true })
  const headers = chess.getHeaders()

  if (
    headers.White !== game.white.policyFingerprint ||
    headers.Black !== game.black.policyFingerprint
  ) {
    throw new TypeError(
      `Stored calibration PGN player identities do not match ${game.gameId}.`,
    )
  }

  chess.setHeader("White", requireAlias(aliases, game.white.policyFingerprint))
  chess.setHeader("Black", requireAlias(aliases, game.black.policyFingerprint))
  return `${chess.pgn({ newline: "\n", maxWidth: 0 })}\n`
}

export default async function createBayesEloInput(
  input: CreateBayesEloInputInput,
): Promise<BayesEloInput> {
  assertPositiveSafeInteger(input.maxPlies, "maxPlies")
  if (input.plan.variant !== "standard") {
    throw new TypeError("BayesElo input currently supports Standard only.")
  }

  const policyAliases = createPolicyAliases(input.plan)
  const aliasByFingerprint = new Map(
    policyAliases.map(({ alias, policyFingerprint }) => [
      policyFingerprint,
      alias,
    ]),
  )
  const pairs = listCalibrationPlanPairs(input.plan)
  const completedPairIds: CalibrationGame["pairId"][] = []
  const completedGamePgns: string[] = []

  for (const [first, second] of pairs) {
    const [firstStored, secondStored] = await Promise.all(
      [first, second].map((game) =>
        loadStoredCalibrationGame({
          rootDirectory: input.rootDirectory,
          plan: input.plan,
          game,
          maxPlies: input.maxPlies,
        }),
      ),
    )
    if (
      firstStored?.marker.resultStatus !== "completed" ||
      secondStored?.marker.resultStatus !== "completed"
    ) {
      continue
    }
    if (
      firstStored.pgnPath === undefined ||
      secondStored.pgnPath === undefined
    ) {
      throw new Error("Completed calibration evidence is missing its PGN.")
    }

    completedPairIds.push(first.pairId)
    completedGamePgns.push(
      rewritePgnPlayerNames(
        await readFile(firstStored.pgnPath, "utf8"),
        first,
        aliasByFingerprint,
      ),
      rewritePgnPlayerNames(
        await readFile(secondStored.pgnPath, "utf8"),
        second,
        aliasByFingerprint,
      ),
    )
  }

  const pgn = completedGamePgns.join("\n")
  const pgnSha256 = sha256Text(pgn)
  const inputIdentity = JSON.stringify({
    schemaVersion: BAYES_ELO_INPUT_SCHEMA_VERSION,
    planId: input.plan.planId,
    maxPlies: input.maxPlies,
    policyAliases,
    completedPairIds,
    pgnSha256,
  })

  return {
    schemaVersion: BAYES_ELO_INPUT_SCHEMA_VERSION,
    planId: input.plan.planId,
    variant: "standard",
    maxPlies: input.maxPlies,
    scheduledPairCount: pairs.length,
    completedPairCount: completedPairIds.length,
    completedGameCount: completedPairIds.length * 2,
    excludedPairCount: pairs.length - completedPairIds.length,
    completedPairIds,
    policyAliases,
    pgn,
    pgnSha256,
    inputSha256: sha256Text(inputIdentity),
  }
}

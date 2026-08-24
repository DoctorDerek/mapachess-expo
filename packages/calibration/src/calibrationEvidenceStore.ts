import { createHash } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { join, resolve } from "node:path"
import createCalibrationGameEvidence, {
  completedCalibrationResultTag,
  serializeCalibrationGameEvidence,
  serializeCalibrationGamePgn,
  type CalibrationGameEvidence,
} from "./calibrationGameEvidence.js"
import type { CalibrationCompletedTermination } from "./calibrationGameTypes.js"
import type { CalibrationGame, CalibrationPlan } from "./calibrationPlan.js"

export const CALIBRATION_COMPLETION_MARKER_SCHEMA_VERSION = 1 as const

const COMPLETION_MARKER_FILE_NAME = "complete.json"
const EVIDENCE_FILE_NAME = "evidence.json"
const PGN_FILE_NAME = "game.pgn"
const SHA256_ID_PATTERN = /^sha256:([0-9a-f]{64})$/
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/

type CalibrationStoredResultTag = "*" | "0-1" | "1-0" | "1/2-1/2"
type CalibrationStoredTermination =
  "max-plies" | CalibrationCompletedTermination["kind"]

export type CalibrationCompletionMarker = Readonly<{
  schemaVersion: typeof CALIBRATION_COMPLETION_MARKER_SCHEMA_VERSION
  blackPolicyFingerprint: string
  evidenceSha256: string
  gameId: string
  gameInPair: 1 | 2
  maxPlies: number
  pairId: string
  pgnSha256: string | null
  planId: string
  resultStatus: "completed" | "unterminated"
  resultTag: CalibrationStoredResultTag
  termination: CalibrationStoredTermination
  whitePolicyFingerprint: string
}>

export type CalibrationEvidencePaths = Readonly<{
  completionMarkerPath: string
  evidencePath: string
  gameDirectory: string
  pgnPath: string
  planDirectory: string
}>

export type LoadStoredCalibrationGameInput = Readonly<{
  game: CalibrationGame
  maxPlies: number
  plan: CalibrationPlan
  rootDirectory: string
}>

export type StoredCalibrationGame = Readonly<{
  completionMarkerPath: string
  evidencePath: string
  gameDirectory: string
  marker: CalibrationCompletionMarker
  pgnPath?: string
}>

export type PersistCalibrationGameEvidenceInput = Readonly<{
  evidence: CalibrationGameEvidence
  plan: CalibrationPlan
  rootDirectory: string
}>

export type PersistCalibrationGameEvidenceResult = Readonly<{
  disposition: "created" | "existing"
  storedGame: StoredCalibrationGame
}>

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (isMissingPath(error)) return false
    throw error
  }
}

function sha256IdPart(value: string, label: string): string {
  const match = SHA256_ID_PATTERN.exec(value)
  const digest = match?.[1]
  if (digest === undefined) {
    throw new TypeError(`${label} must be a SHA-256 identifier.`)
  }

  return digest
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function resolveCalibrationEvidencePaths(
  rootDirectory: string,
  plan: CalibrationPlan,
  game: CalibrationGame,
): CalibrationEvidencePaths {
  const resolvedRoot = resolve(rootDirectory)
  const planDirectory = join(resolvedRoot, sha256IdPart(plan.planId, "planId"))
  const gameDirectory = join(
    planDirectory,
    `${sha256IdPart(game.pairId, "pairId")}-game-${game.gameInPair}`,
  )
  const completionMarkerPath = join(gameDirectory, COMPLETION_MARKER_FILE_NAME)
  const evidencePath = join(gameDirectory, EVIDENCE_FILE_NAME)
  const pgnPath = join(gameDirectory, PGN_FILE_NAME)

  return {
    planDirectory,
    gameDirectory,
    completionMarkerPath,
    evidencePath,
    pgnPath,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_PATTERN.test(value)
}

function isResultStatus(
  value: unknown,
): value is CalibrationCompletionMarker["resultStatus"] {
  return value === "completed" || value === "unterminated"
}

function isResultTag(
  value: unknown,
): value is CalibrationCompletionMarker["resultTag"] {
  return (
    value === "*" || value === "0-1" || value === "1-0" || value === "1/2-1/2"
  )
}

function isTermination(
  value: unknown,
): value is CalibrationCompletionMarker["termination"] {
  return (
    value === "checkmate" ||
    value === "fifty-move-rule" ||
    value === "insufficient-material" ||
    value === "max-plies" ||
    value === "stalemate" ||
    value === "threefold-repetition"
  )
}

function isCompletionMarker(
  value: unknown,
): value is CalibrationCompletionMarker {
  if (!isRecord(value)) return false

  return (
    value.schemaVersion === CALIBRATION_COMPLETION_MARKER_SCHEMA_VERSION &&
    typeof value.blackPolicyFingerprint === "string" &&
    isSha256Hex(value.evidenceSha256) &&
    typeof value.gameId === "string" &&
    (value.gameInPair === 1 || value.gameInPair === 2) &&
    isPositiveSafeInteger(value.maxPlies) &&
    typeof value.pairId === "string" &&
    (value.pgnSha256 === null || isSha256Hex(value.pgnSha256)) &&
    typeof value.planId === "string" &&
    isResultStatus(value.resultStatus) &&
    isResultTag(value.resultTag) &&
    isTermination(value.termination) &&
    typeof value.whitePolicyFingerprint === "string"
  )
}

function parseCompletionMarker(
  serialized: string,
): CalibrationCompletionMarker {
  const parsed: unknown = JSON.parse(serialized)
  if (!isCompletionMarker(parsed)) {
    throw new TypeError("Calibration completion marker is invalid.")
  }

  if (
    parsed.resultStatus === "completed" &&
    (parsed.resultTag === "*" ||
      parsed.termination === "max-plies" ||
      parsed.pgnSha256 === null)
  ) {
    throw new TypeError("Completed calibration marker outcome is invalid.")
  }
  if (
    parsed.resultStatus === "unterminated" &&
    (parsed.resultTag !== "*" ||
      parsed.termination !== "max-plies" ||
      parsed.pgnSha256 !== null)
  ) {
    throw new TypeError("Unterminated calibration marker outcome is invalid.")
  }

  return parsed
}

function assertMatchingIdentity(
  actual: number | string,
  expected: number | string,
  label: string,
): void {
  if (actual !== expected) {
    throw new Error(`Stored calibration marker ${label} does not match.`)
  }
}

function assertMarkerIdentity(
  marker: CalibrationCompletionMarker,
  input: LoadStoredCalibrationGameInput,
): void {
  assertMatchingIdentity(marker.planId, input.plan.planId, "planId")
  assertMatchingIdentity(marker.pairId, input.game.pairId, "pairId")
  assertMatchingIdentity(marker.gameId, input.game.gameId, "gameId")
  assertMatchingIdentity(marker.gameInPair, input.game.gameInPair, "gameInPair")
  assertMatchingIdentity(marker.maxPlies, input.maxPlies, "maxPlies")
  assertMatchingIdentity(
    marker.whitePolicyFingerprint,
    input.game.white.policyFingerprint,
    "whitePolicyFingerprint",
  )
  assertMatchingIdentity(
    marker.blackPolicyFingerprint,
    input.game.black.policyFingerprint,
    "blackPolicyFingerprint",
  )
}

export async function loadStoredCalibrationGame(
  input: LoadStoredCalibrationGameInput,
): Promise<StoredCalibrationGame | undefined> {
  const paths = resolveCalibrationEvidencePaths(
    input.rootDirectory,
    input.plan,
    input.game,
  )
  if (!(await pathExists(paths.gameDirectory))) return undefined

  const gameDirectoryStat = await stat(paths.gameDirectory)
  if (!gameDirectoryStat.isDirectory()) {
    throw new Error(
      `Stored calibration game must be a directory: ${paths.gameDirectory}.`,
    )
  }

  const marker = parseCompletionMarker(
    await readFile(paths.completionMarkerPath, "utf8"),
  )
  assertMarkerIdentity(marker, input)

  const evidenceText = await readFile(paths.evidencePath, "utf8")
  if (sha256Text(evidenceText) !== marker.evidenceSha256) {
    throw new Error("Stored calibration evidence SHA-256 does not match.")
  }

  if (marker.pgnSha256 === null) {
    if (await pathExists(paths.pgnPath)) {
      throw new Error("Unterminated calibration evidence must not have PGN.")
    }

    return {
      gameDirectory: paths.gameDirectory,
      completionMarkerPath: paths.completionMarkerPath,
      evidencePath: paths.evidencePath,
      marker,
    }
  }

  const pgnText = await readFile(paths.pgnPath, "utf8")
  if (sha256Text(pgnText) !== marker.pgnSha256) {
    throw new Error("Stored calibration PGN SHA-256 does not match.")
  }

  return {
    gameDirectory: paths.gameDirectory,
    completionMarkerPath: paths.completionMarkerPath,
    evidencePath: paths.evidencePath,
    pgnPath: paths.pgnPath,
    marker,
  }
}

function completionMarker(
  evidence: CalibrationGameEvidence,
  evidenceText: string,
  pgnText: string | undefined,
): CalibrationCompletionMarker {
  const result = evidence.result
  return {
    schemaVersion: CALIBRATION_COMPLETION_MARKER_SCHEMA_VERSION,
    planId: evidence.planId,
    pairId: evidence.game.pairId,
    gameId: evidence.game.gameId,
    gameInPair: evidence.game.gameInPair,
    maxPlies: evidence.maxPlies,
    whitePolicyFingerprint: evidence.game.white.policyFingerprint,
    blackPolicyFingerprint: evidence.game.black.policyFingerprint,
    resultStatus: result.status,
    resultTag:
      result.status === "completed"
        ? completedCalibrationResultTag(result)
        : "*",
    termination:
      result.status === "completed" ? result.termination.kind : "max-plies",
    evidenceSha256: sha256Text(evidenceText),
    pgnSha256: pgnText === undefined ? null : sha256Text(pgnText),
  }
}

export default async function persistCalibrationGameEvidence(
  input: PersistCalibrationGameEvidenceInput,
): Promise<PersistCalibrationGameEvidenceResult> {
  const evidence = createCalibrationGameEvidence({
    plan: input.plan,
    maxPlies: input.evidence.maxPlies,
    result: input.evidence.result,
  })
  if (
    serializeCalibrationGameEvidence(evidence) !==
    serializeCalibrationGameEvidence(input.evidence)
  ) {
    throw new TypeError("Calibration evidence does not match its plan.")
  }

  const loadInput = {
    rootDirectory: input.rootDirectory,
    plan: input.plan,
    game: evidence.game,
    maxPlies: evidence.maxPlies,
  }
  const existing = await loadStoredCalibrationGame(loadInput)
  if (existing !== undefined) {
    return { disposition: "existing", storedGame: existing }
  }

  const paths = resolveCalibrationEvidencePaths(
    input.rootDirectory,
    input.plan,
    evidence.game,
  )
  await mkdir(paths.planDirectory, { recursive: true })
  const stagingDirectory = await mkdtemp(
    join(paths.planDirectory, `.${evidence.game.gameInPair}-`),
  )

  try {
    const evidenceText = serializeCalibrationGameEvidence(evidence)
    const pgnText =
      evidence.result.status === "completed"
        ? serializeCalibrationGamePgn(evidence)
        : undefined
    const marker = completionMarker(evidence, evidenceText, pgnText)

    await writeFile(
      resolve(stagingDirectory, EVIDENCE_FILE_NAME),
      evidenceText,
      "utf8",
    )
    if (pgnText !== undefined) {
      await writeFile(resolve(stagingDirectory, PGN_FILE_NAME), pgnText, "utf8")
    }
    await writeFile(
      resolve(stagingDirectory, COMPLETION_MARKER_FILE_NAME),
      `${JSON.stringify(marker, null, 2)}\n`,
      "utf8",
    )

    let disposition: PersistCalibrationGameEvidenceResult["disposition"] =
      "created"
    try {
      await rename(stagingDirectory, paths.gameDirectory)
    } catch (error) {
      if (!(await pathExists(paths.gameDirectory))) throw error
      disposition = "existing"
    }

    const storedGame = await loadStoredCalibrationGame(loadInput)
    if (storedGame === undefined) {
      throw new Error("Persisted calibration evidence is missing.")
    }

    return { disposition, storedGame }
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true })
  }
}

import type { CalibrationGameResult } from "./calibrationGameTypes.js"
import type {
  CalibrationGame,
  CalibrationPlan,
  CalibrationPolicyRecord,
} from "./calibrationPlan.js"

export const CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION = 1 as const

export type CalibrationGameEvidence = Readonly<{
  schemaVersion: typeof CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION
  game: CalibrationGame
  maxPlies: number
  planId: CalibrationPlan["planId"]
  planSeed: CalibrationPlan["seed"]
  policies: Readonly<{
    black: CalibrationPolicyRecord
    white: CalibrationPolicyRecord
  }>
  result: CalibrationGameResult
}>

export type CreateCalibrationGameEvidenceInput = Readonly<{
  maxPlies: number
  plan: CalibrationPlan
  result: CalibrationGameResult
}>

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function requireScheduledGame(
  plan: CalibrationPlan,
  result: CalibrationGameResult,
): CalibrationGame {
  const game = plan.games.find(
    (scheduledGame) => scheduledGame.gameId === result.gameId,
  )

  if (game === undefined) {
    throw new TypeError(
      `Calibration result game is not scheduled by ${plan.planId}: ${result.gameId}.`,
    )
  }

  if (game.pairId !== result.pairId) {
    throw new TypeError(
      `Calibration result pair does not match ${result.gameId}.`,
    )
  }

  return game
}

function requirePolicy(
  plan: CalibrationPlan,
  game: CalibrationGame,
  color: "black" | "white",
): CalibrationPolicyRecord {
  const fingerprint = game[color].policyFingerprint
  const policy = plan.policies.find(
    (record) => record.fingerprint === fingerprint,
  )

  if (policy === undefined) {
    throw new TypeError(
      `Calibration ${color} policy is missing from ${plan.planId}: ${fingerprint}.`,
    )
  }

  return policy
}

function validateResultFlow(
  game: CalibrationGame,
  maxPlies: number,
  result: CalibrationGameResult,
): void {
  if (result.moves.length > maxPlies) {
    throw new TypeError(
      `Calibration result exceeds its ${maxPlies}-ply execution bound.`,
    )
  }

  if (
    result.status === "unterminated" &&
    (result.maxPlies !== maxPlies || result.moves.length !== maxPlies)
  ) {
    throw new TypeError(
      "An unterminated calibration result must exhaust its execution bound.",
    )
  }

  let expectedFen = game.fen

  for (const [index, move] of result.moves.entries()) {
    const expectedPly = index + 1
    const expectedFingerprint = game[move.color].policyFingerprint

    if (move.ply !== expectedPly) {
      throw new TypeError(
        `Calibration result move ${expectedPly} has ply ${move.ply}.`,
      )
    }
    if (move.policyFingerprint !== expectedFingerprint) {
      throw new TypeError(
        `Calibration result move ${expectedPly} has the wrong ${move.color} policy.`,
      )
    }
    if (move.fenBefore !== expectedFen) {
      throw new TypeError(
        `Calibration result move ${expectedPly} breaks the FEN chain.`,
      )
    }

    expectedFen = move.fenAfter
  }

  if (result.finalFen !== expectedFen) {
    throw new TypeError("Calibration result final FEN breaks the move chain.")
  }
}

export default function createCalibrationGameEvidence(
  input: CreateCalibrationGameEvidenceInput,
): CalibrationGameEvidence {
  assertPositiveSafeInteger(input.maxPlies, "maxPlies")
  const game = requireScheduledGame(input.plan, input.result)
  validateResultFlow(game, input.maxPlies, input.result)

  return {
    schemaVersion: CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION,
    planId: input.plan.planId,
    planSeed: input.plan.seed,
    game,
    maxPlies: input.maxPlies,
    policies: {
      black: requirePolicy(input.plan, game, "black"),
      white: requirePolicy(input.plan, game, "white"),
    },
    result: input.result,
  }
}

export function serializeCalibrationGameEvidence(
  evidence: CalibrationGameEvidence,
): string {
  return `${JSON.stringify(evidence, null, 2)}\n`
}

import { Chess } from "chess.js"
import type {
  CalibrationGameResult,
  CompletedCalibrationGameResult,
} from "./calibrationGameTypes.js"
import type {
  CalibrationGame,
  CalibrationPlan,
  CalibrationPolicyRecord,
} from "./calibrationPlan.js"

export const CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION = 1 as const

const STANDARD_START_FEN = new Chess().fen()

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

export function completedCalibrationResultTag(
  result: CompletedCalibrationGameResult,
): "0-1" | "1-0" | "1/2-1/2" {
  if (result.termination.kind !== "checkmate") return "1/2-1/2"
  return result.termination.winner === "white" ? "1-0" : "0-1"
}

export function serializeCalibrationGamePgn(
  evidence: CalibrationGameEvidence,
): string {
  if (evidence.result.status !== "completed") {
    throw new TypeError(
      "Only a completed calibration game can be exported as PGN.",
    )
  }

  const result = evidence.result
  const resultTag = completedCalibrationResultTag(result)
  const chess = new Chess(evidence.game.fen)
  chess.setHeader("Event", `Mapachess calibration: ${evidence.game.edgeId}`)
  chess.setHeader("Site", "Local")
  chess.setHeader("Date", "????.??.??")
  chess.setHeader("Round", String(evidence.game.gameInPair))
  chess.setHeader("White", evidence.game.white.policyFingerprint)
  chess.setHeader("Black", evidence.game.black.policyFingerprint)
  chess.setHeader("Result", resultTag)
  chess.setHeader("MapachessPlan", evidence.planId)
  chess.setHeader("MapachessPair", evidence.game.pairId)
  chess.setHeader("MapachessGame", evidence.game.gameId)
  chess.setHeader("MapachessOpening", evidence.game.openingId)
  chess.setHeader("MapachessWhiteSeed", String(evidence.game.white.randomSeed))
  chess.setHeader("MapachessBlackSeed", String(evidence.game.black.randomSeed))
  chess.setHeader("MapachessTermination", result.termination.kind)

  if (evidence.game.fen !== STANDARD_START_FEN) {
    chess.setHeader("SetUp", "1")
    chess.setHeader("FEN", evidence.game.fen)
  }

  for (const move of result.moves) {
    chess.move(
      {
        from: move.uci.slice(0, 2),
        to: move.uci.slice(2, 4),
        ...(move.uci.length === 5 ? { promotion: move.uci.slice(4) } : {}),
      },
      { strict: true },
    )
  }

  if (chess.fen() !== result.finalFen) {
    throw new TypeError(
      "Calibration PGN replay does not reach the recorded final FEN.",
    )
  }

  return `${chess.pgn({ newline: "\n", maxWidth: 0 })}\n`
}

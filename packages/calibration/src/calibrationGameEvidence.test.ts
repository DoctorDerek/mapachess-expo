import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"
import {
  mateInOneEvidenceFixture,
  stalemateResultFixture,
  standardPlanFixture,
} from "../test/calibrationFixtures"
import createCalibrationGameEvidence, {
  CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION,
  serializeCalibrationGameEvidence,
  serializeCalibrationGamePgn,
  type CalibrationGameEvidence,
} from "./calibrationGameEvidence"

function createFixture(seed = 42): Readonly<{
  plan: ReturnType<typeof standardPlanFixture>
  result: ReturnType<typeof stalemateResultFixture>
}> {
  const plan = standardPlanFixture(undefined, seed)
  return { plan, result: stalemateResultFixture(plan) }
}

describe("calibration game evidence", () => {
  it("captures the exact plan, policies, bound, and result", () => {
    const fixture = createFixture()
    const evidence = createCalibrationGameEvidence({
      ...fixture,
      maxPlies: 200,
    })

    expect(evidence).toMatchObject({
      schemaVersion: CALIBRATION_GAME_EVIDENCE_SCHEMA_VERSION,
      planId: fixture.plan.planId,
      planSeed: fixture.plan.seed,
      maxPlies: 200,
      result: fixture.result,
    })
    expect(evidence.policies.white.fingerprint).toBe(
      evidence.game.white.policyFingerprint,
    )
    expect(evidence.policies.black.fingerprint).toBe(
      evidence.game.black.policyFingerprint,
    )
    expect(JSON.parse(serializeCalibrationGameEvidence(evidence))).toEqual(
      evidence,
    )
    expect(serializeCalibrationGameEvidence(evidence)).toMatch(/\n$/)
  })

  it("rejects a result outside the scheduled plan", () => {
    const fixture = createFixture()
    const otherFixture = createFixture(43)

    expect(() =>
      createCalibrationGameEvidence({
        plan: fixture.plan,
        maxPlies: 200,
        result: {
          ...fixture.result,
          gameId: otherFixture.result.gameId,
        },
      }),
    ).toThrow("is not scheduled")
  })

  it("rejects a move attributed to the wrong seat policy", () => {
    const fixture = createFixture()
    const game = fixture.plan.games[0]
    if (game === undefined) throw new Error("Fixture game is missing.")

    expect(() =>
      createCalibrationGameEvidence({
        plan: fixture.plan,
        maxPlies: 200,
        result: {
          ...fixture.result,
          finalFen: "fixture-after",
          moves: [
            {
              ply: 1,
              color: "white",
              policyFingerprint: game.black.policyFingerprint,
              source: "stockfish",
              uci: "f7f8",
              fenBefore: game.fen,
              fenAfter: "fixture-after",
            },
          ],
        },
      }),
    ).toThrow("has the wrong white policy")
  })

  it("rejects an unterminated result that did not exhaust its bound", () => {
    const fixture = createFixture()

    expect(() =>
      createCalibrationGameEvidence({
        plan: fixture.plan,
        maxPlies: 200,
        result: {
          ...fixture.result,
          status: "unterminated",
          termination: "max-plies",
          maxPlies: 100,
        },
      }),
    ).toThrow("must exhaust its execution bound")
  })

  it("exports a completed game as strict replayable PGN", () => {
    const { evidence } = mateInOneEvidenceFixture()
    const pgn = serializeCalibrationGamePgn(evidence)
    const replay = new Chess()
    replay.loadPgn(pgn, { strict: true })

    expect(replay.fen()).toBe(evidence.result.finalFen)
    expect(replay.getHeaders()).toMatchObject({
      Event: "Mapachess calibration: fixture-edge",
      Site: "Local",
      Date: "????.??.??",
      Round: "1",
      White: evidence.game.white.policyFingerprint,
      Black: evidence.game.black.policyFingerprint,
      Result: "1-0",
      SetUp: "1",
      FEN: evidence.game.fen,
      MapachessPlan: evidence.planId,
      MapachessPair: evidence.game.pairId,
      MapachessGame: evidence.game.gameId,
      MapachessOpening: evidence.game.openingId,
      MapachessTermination: "checkmate",
    })
    expect(pgn).toMatch(/1\. Qg7# 1-0\n$/)
  })

  it("exports a completed draw and rejects an unfinished game", () => {
    const fixture = createFixture()
    const drawEvidence = createCalibrationGameEvidence({
      ...fixture,
      maxPlies: 200,
    })
    expect(serializeCalibrationGamePgn(drawEvidence)).toMatch(
      /\[Result "1\/2-1\/2"\]/,
    )

    const { evidence: completedEvidence } = mateInOneEvidenceFixture()
    const unfinishedEvidence: CalibrationGameEvidence = {
      ...completedEvidence,
      maxPlies: 1,
      result: {
        gameId: completedEvidence.result.gameId,
        pairId: completedEvidence.result.pairId,
        finalFen: completedEvidence.result.finalFen,
        moves: completedEvidence.result.moves,
        status: "unterminated",
        termination: "max-plies",
        maxPlies: 1,
      },
    }
    expect(() => serializeCalibrationGamePgn(unfinishedEvidence)).toThrow(
      "Only a completed calibration game can be exported as PGN",
    )
  })
})

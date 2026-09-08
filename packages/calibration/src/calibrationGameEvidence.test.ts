import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"
import {
  completedChess960EvidenceFixture,
  MATE_IN_ONE_FEN,
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
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
} from "./calibrationPlan"
import { CALIBRATION_CANONICAL_LEGAL_MOVE_GENERATOR_VERSION } from "./opponentPolicy"

function createFixture(seed = 42): Readonly<{
  plan: ReturnType<typeof standardPlanFixture>
  result: ReturnType<typeof stalemateResultFixture>
}> {
  const plan = standardPlanFixture(undefined, seed)
  return { plan, result: stalemateResultFixture(plan) }
}

describe("calibration game evidence", () => {
  it("replays canonical Standard evidence and rejects a false recorded final FEN", () => {
    const fixture = mateInOneEvidenceFixture()
    const policies = fixture.plan.policies.map(({ policy }) => ({
      ...policy,
      moveSelection: {
        ...policy.moveSelection,
        legalMoveGeneratorVersion:
          CALIBRATION_CANONICAL_LEGAL_MOVE_GENERATOR_VERSION,
      },
    }))
    const [policyA, policyB] = policies
    if (policyA === undefined || policyB === undefined)
      throw new Error("Fixture policies missing.")
    const plan = createCalibrationPlan({
      schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
      seed: 42,
      variant: "standard",
      openings: [{ id: "canonical-mate", fen: MATE_IN_ONE_FEN }],
      edges: [{ id: "canonical", pairsPerOpening: 1, policyA, policyB }],
    })
    const game = plan.games[0]
    if (game === undefined) throw new Error("Fixture game missing.")
    const evidence = createCalibrationGameEvidence({
      plan,
      maxPlies: 10,
      result: {
        ...fixture.evidence.result,
        gameId: game.gameId,
        pairId: game.pairId,
        moves: fixture.evidence.result.moves.map((move) => ({
          ...move,
          policyFingerprint: game[move.color].policyFingerprint,
        })),
      },
    })
    const pgn = serializeCalibrationGamePgn(evidence)
    const replay = new Chess()
    replay.loadPgn(pgn, { strict: true })
    expect(replay.fen()).toBe(evidence.result.finalFen)
    expect(pgn).not.toContain('[Variant "Chess960"]')
    expect(() =>
      serializeCalibrationGamePgn({
        ...evidence,
        result: { ...evidence.result, finalFen: game.fen },
      }),
    ).toThrow("recorded final FEN")
  })

  it("exports Chess960 castling and a completed repetition with explicit variant metadata", () => {
    const evidence = completedChess960EvidenceFixture(
      "4k1n1/8/8/8/8/8/8/R4KR1 w GA - 0 1",
      ["f1g1", "g8f6", "g1h1", "f6g8", "h1g1", "g8f6", "g1h1", "f6g8", "h1g1"],
    )
    const pgn = serializeCalibrationGamePgn(evidence)
    expect(pgn).toContain('[Variant "Chess960"]')
    expect(pgn).toContain('[MapachessChess960Position "0"]')
    expect(pgn).toContain(`[FEN "${evidence.game.fen}"]`)
    expect(pgn).toContain('[MapachessTermination "threefold-repetition"]')
    expect(pgn).toMatch(
      /1\. O-O Nf6 2\. Kh1 Ng8 3\. Kg1 Nf6 4\. Kh1 Ng8 5\. Kg1 1\/2-1\/2\n$/,
    )
    expect(evidence.result.finalFen).toBe("4k1n1/8/8/8/8/8/8/R4RK1 b - - 9 5")
  })

  it("numbers a Chess960 game starting with Black at its recorded full move", () => {
    const evidence = completedChess960EvidenceFixture(
      "8/8/8/8/8/5kq1/8/7K b - - 0 7",
      ["g3g2"],
    )
    expect(serializeCalibrationGamePgn(evidence)).toMatch(/7\.\.\. Qg2# 0-1\n$/)
  })

  it("rejects a Chess960 PGN with a false final position or termination", () => {
    const evidence = completedChess960EvidenceFixture(MATE_IN_ONE_FEN, ["g6g7"])
    expect(() =>
      serializeCalibrationGamePgn({
        ...evidence,
        result: { ...evidence.result, finalFen: evidence.game.fen },
      }),
    ).toThrow("recorded final FEN")
    expect(() =>
      serializeCalibrationGamePgn({
        ...evidence,
        result: {
          ...evidence.result,
          status: "completed",
          termination: { kind: "stalemate" },
        },
      }),
    ).toThrow("recorded termination")
    const [move] = evidence.result.moves
    if (move === undefined) throw new Error("Fixture move is missing.")
    expect(() =>
      serializeCalibrationGamePgn({
        ...evidence,
        result: { ...evidence.result, moves: [{ ...move, color: "black" }] },
      }),
    ).toThrow("recorded move")
  })
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

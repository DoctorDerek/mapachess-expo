import { describe, expect, it } from "vitest"
import createCalibrationChessPosition from "./calibrationChessPosition"
import { indexCalibrationPolicies } from "./calibrationPolicyRegistry"
import chess960CalibrationSmokePlan from "./chess960CalibrationSmokePlan"
import fingerprintOpponentPolicy, {
  CALIBRATION_CHESS960_LEGAL_MOVE_GENERATOR_VERSION,
  CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
} from "./opponentPolicy"
import standardCalibrationSmokePlan from "./standardCalibrationSmokePlan"
import standardChickenCandidatePlan from "./standardChickenCandidatePlan"

describe("bounded Chess960 calibration smoke plan", () => {
  it("pairs the canonical non-orthodox position zero with reversed seats and seeds", () => {
    const plan = chess960CalibrationSmokePlan
    const [first, second] = plan.games
    if (first === undefined || second === undefined)
      throw new Error("Smoke pair is missing.")
    expect(plan.games).toHaveLength(2)
    expect(plan.variant).toBe("chess960")
    expect(first.chess960PositionId).toBe(0)
    expect(second.chess960PositionId).toBe(0)
    expect(first.fen.split(" ")[0]).toBe(
      "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR",
    )
    expect(second.fen).toBe(first.fen)
    expect(first.white).toEqual(second.black)
    expect(first.black).toEqual(second.white)
    expect(
      createCalibrationChessPosition(first).legalMoves().length,
    ).toBeGreaterThan(0)
    expect(indexCalibrationPolicies(plan.policies).size).toBe(2)
    expect(
      plan.policies
        .map(({ policy }) => policy.search.nodeLimit)
        .sort((a, b) => a - b),
    ).toEqual([1_000, 2_000])
    expect(
      plan.policies.every(
        ({ policy }) =>
          policy.moveSelection.legalMoveGeneratorVersion ===
          CALIBRATION_CHESS960_LEGAL_MOVE_GENERATOR_VERSION,
      ),
    ).toBe(true)
    expect(plan.planId).not.toBe(standardCalibrationSmokePlan.planId)
  })

  it("preserves the recorded 240-game Standard candidate plan identity", () => {
    expect(standardChickenCandidatePlan.planId).toBe(
      "sha256:dc43821f95a9ca0d60fb29aa90bf4cd98c921af6dcdaa0327820a58919d4463f",
    )
    expect(standardChickenCandidatePlan.games).toHaveLength(240)
    expect(
      standardChickenCandidatePlan.games.every(
        (game) => game.chess960PositionId === undefined,
      ),
    ).toBe(true)
  })

  it("rejects a Chess960 policy claiming the historical Standard rules identity", () => {
    const record = chess960CalibrationSmokePlan.policies[0]
    if (record === undefined) throw new Error("Smoke policy is missing.")
    const policy = {
      ...record.policy,
      moveSelection: {
        ...record.policy.moveSelection,
        legalMoveGeneratorVersion: CALIBRATION_LEGAL_MOVE_GENERATOR_VERSION,
      },
    }
    expect(fingerprintOpponentPolicy(policy)).not.toBe(record.fingerprint)
    expect(() =>
      indexCalibrationPolicies([
        { policy, fingerprint: fingerprintOpponentPolicy(policy) },
      ]),
    ).toThrow("Unsupported calibration legal-move generator")
  })
})

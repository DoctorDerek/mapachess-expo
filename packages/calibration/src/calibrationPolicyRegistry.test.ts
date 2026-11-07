import { describe, expect, it } from "vitest"
import { standardPolicyFixture } from "../test/calibrationFixtures"
import {
  indexCalibrationPolicies,
  requireCalibrationPolicy,
  stockfishConfigurationFromPolicy,
} from "./calibrationPolicyRegistry"
import fingerprintOpponentPolicy, {
  WEB_CALIBRATION_ENGINE_IDENTITY,
  type OpponentPolicy,
} from "./opponentPolicy"

const policy = standardPolicyFixture(1000)
const record = (value: OpponentPolicy) => ({
  policy: value,
  fingerprint: fingerprintOpponentPolicy(value),
})
describe("calibration executable-policy registry", () => {
  it("retains one canonical verified policy and resolves each engine configuration without inference", () => {
    const entry = record(policy)
    const policies = indexCalibrationPolicies([entry])
    expect(requireCalibrationPolicy(policies, entry.fingerprint, "white")).toBe(
      policy,
    )
    expect(stockfishConfigurationFromPolicy(policy)).toEqual({
      variant: "standard",
      strength: { kind: "full-strength" },
      threads: 1,
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
    })
    expect(() => indexCalibrationPolicies([entry, entry])).toThrow(
      "must be unique",
    )
    expect(() =>
      indexCalibrationPolicies([
        { ...entry, policy: standardPolicyFixture(2000) },
      ]),
    ).toThrow("does not match its policy")
    expect(() =>
      requireCalibrationPolicy(new Map(), entry.fingerprint, "black"),
    ).toThrow("black policy is missing")
  })

  it.each([
    { field: "threads", search: { threads: 2 } },
    { field: "MultiPV", search: { multiPv: 2 } },
    { field: "pondering", search: { ponder: true } },
    {
      field: "command protocol",
      search: { commandProtocolVersion: "unsupported" },
    },
  ])(
    "rejects an unsupported $field policy before starting a process",
    ({ search }) => {
      expect(() =>
        indexCalibrationPolicies([
          record({ ...policy, search: { ...policy.search, ...search } }),
        ]),
      ).toThrow()
    },
  )

  it.each([
    {
      algorithmVersion: "unsupported",
      legalMoveGeneratorVersion: policy.moveSelection.legalMoveGeneratorVersion,
    },
    {
      algorithmVersion: policy.moveSelection.algorithmVersion,
      legalMoveGeneratorVersion: "unsupported",
    },
  ])("rejects an unknown move-selection implementation (%#)", (selection) => {
    expect(() =>
      indexCalibrationPolicies([
        record({
          ...policy,
          moveSelection: { ...policy.moveSelection, ...selection },
        }),
      ]),
    ).toThrow()
  })

  it.each([
    {
      algorithmVersion: "unsupported",
      seedDerivationVersion: policy.randomness.seedDerivationVersion,
    },
    {
      algorithmVersion: policy.randomness.algorithmVersion,
      seedDerivationVersion: "unsupported",
    },
  ])("rejects unknown randomness semantics (%#)", (randomness) => {
    expect(() =>
      indexCalibrationPolicies([record({ ...policy, randomness })]),
    ).toThrow("randomness version")
  })

  it("rejects an incompatible process adapter or a web engine under a process policy", () => {
    expect(() =>
      indexCalibrationPolicies([
        record({
          ...policy,
          runtime: { ...policy.runtime, adapterVersion: "unsupported" },
        }),
      ]),
    ).toThrow("process adapter version")
    expect(() =>
      indexCalibrationPolicies([
        record({ ...policy, engine: WEB_CALIBRATION_ENGINE_IDENTITY }),
      ]),
    ).toThrow("web Stockfish calibration policy")
  })
})

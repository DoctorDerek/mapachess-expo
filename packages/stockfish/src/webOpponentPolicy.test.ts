import { describe, expect, it } from "vitest"
import {
  WEB_CALIBRATED_LADDER,
  WEB_CHALLENGE_PRESETS,
  WEB_LADDER_RANDOM_BASIS_POINTS,
  WEB_OPPONENT_ENGINE_CONFIGURATION,
  WEB_OPPONENT_NODE_LIMIT,
} from "./webOpponentPolicy"
import webPresetRows from "./webPresetRows"

describe("rated web policy catalog consistency", () => {
  it.each(["standard", "chess960"] as const)(
    "preserves every calibrated %s target and its exact policy identity",
    (variant) => {
      const presets = WEB_CHALLENGE_PRESETS[variant]
      expect(presets.map(({ targetElo }) => targetElo)).toEqual(
        Array.from({ length: 91 }, (_, index) => 100 + index * 25),
      )
      for (const [index, calibrated] of WEB_CALIBRATED_LADDER[
        variant
      ].entries()) {
        const targetElo = (index + 1) * 100
        const override = webPresetRows[variant].find(
          ([target]) => target === targetElo,
        )
        expect(
          presets.find((preset) => preset.targetElo === targetElo),
        ).toEqual({
          targetElo,
          ...(override === undefined
            ? calibrated
            : {
                randomMoveProbabilityBasisPoints: override[1],
                calibrationFingerprint: override[2],
              }),
        })
      }
      for (const preset of presets) {
        expect(Number.isInteger(preset.randomMoveProbabilityBasisPoints)).toBe(
          true,
        )
        expect(preset.randomMoveProbabilityBasisPoints).toBeGreaterThanOrEqual(
          0,
        )
        expect(preset.randomMoveProbabilityBasisPoints).toBeLessThanOrEqual(
          10000,
        )
        expect(preset.calibrationFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
        expect(Object.isFrozen(preset)).toBe(true)
      }
      expect(WEB_LADDER_RANDOM_BASIS_POINTS[variant]).toEqual(
        WEB_CALIBRATED_LADDER[variant].map(
          ({ randomMoveProbabilityBasisPoints }) =>
            randomMoveProbabilityBasisPoints,
        ),
      )
      expect(Object.isFrozen(presets)).toBe(true)
    },
  )

  it("keeps variant-specific calibration fingerprints and the unchanged full-strength search budget", () => {
    const standard = WEB_CHALLENGE_PRESETS.standard
    const chess960 = WEB_CHALLENGE_PRESETS.chess960
    expect(
      standard.every(
        (preset, index) =>
          preset.calibrationFingerprint !==
          chess960[index]?.calibrationFingerprint,
      ),
    ).toBe(true)
    expect(WEB_OPPONENT_NODE_LIMIT).toBe(10000)
    expect(WEB_OPPONENT_ENGINE_CONFIGURATION).toEqual({
      threads: 1,
      hashMegabytes: 16,
      multiPv: 1,
      ponder: false,
      strength: { kind: "full-strength" },
    })
  })
})

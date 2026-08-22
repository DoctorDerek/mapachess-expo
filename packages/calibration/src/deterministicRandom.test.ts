import { describe, expect, it } from "vitest"
import createDeterministicRandom, {
  CALIBRATION_RANDOM_ALGORITHM_VERSION,
  CALIBRATION_SEED_DERIVATION_VERSION,
  deriveCalibrationSeed,
  parseCalibrationRootSeed,
  parseCalibrationSeed,
  shuffleDeterministically,
} from "./deterministicRandom"

describe("deterministic random stream", () => {
  it("replays a known unsigned 32-bit sequence", () => {
    const random = createDeterministicRandom(
      parseCalibrationSeed("00000001000000020000000300000004"),
    )

    expect([
      random.nextUint32(),
      random.nextUint32(),
      random.nextUint32(),
      random.nextUint32(),
    ]).toEqual([11_520, 0, 5_927_040, 70_819_200])
    expect(CALIBRATION_RANDOM_ALGORITHM_VERSION).toBe(
      "xoshiro128starstar-1.1/v1",
    )
  })

  it("replays known bounded indices inside the requested interval", () => {
    const random = createDeterministicRandom(
      parseCalibrationSeed("00000001000000020000000300000004"),
    )

    expect(Array.from({ length: 16 }, () => random.nextIndex(7))).toEqual([
      5, 0, 0, 4, 2, 4, 4, 6, 5, 6, 2, 1, 3, 2, 0, 3,
    ])
  })

  it("rejects the modulo-bias tail before selecting an index", () => {
    const random = createDeterministicRandom(
      parseCalibrationSeed("00000001000b60b50000000300000004"),
    )

    expect(random.nextIndex(2_147_483_649)).toBe(5_504)
  })

  it.each([-1, 0.5, 0x1_0000_0000, "42"])("rejects invalid seed %s", (seed) => {
    expect(() => parseCalibrationRootSeed(seed)).toThrow(TypeError)
  })

  it("uses the supplied seed label", () => {
    expect(() => parseCalibrationRootSeed(-1, "plan seed")).toThrow(
      "plan seed must be an unsigned 32-bit integer.",
    )
  })

  it.each([null, 1, "", "0".repeat(32), "A".repeat(32), "g".repeat(32)])(
    "rejects invalid deterministic state %s",
    (seed) => {
      expect(() => parseCalibrationSeed(seed)).toThrow(TypeError)
    },
  )

  it("uses the supplied deterministic-state label", () => {
    expect(() => parseCalibrationSeed("invalid", "game seed")).toThrow(
      "game seed must be a lowercase nonzero 128-bit hexadecimal state.",
    )
  })

  it.each([0, -1, 1.5, 0x1_0000_0001])(
    "rejects invalid upper bound %s",
    (upperExclusive) => {
      const random = createDeterministicRandom(
        parseCalibrationSeed("00000001000000020000000300000004"),
      )

      expect(() => random.nextIndex(upperExclusive)).toThrow(TypeError)
    },
  )

  it("accepts the complete unsigned 32-bit output interval", () => {
    const random = createDeterministicRandom(
      parseCalibrationSeed("00000001000000020000000300000004"),
    )

    expect(random.nextIndex(0x1_0000_0000)).toBe(11_520)
  })

  it("derives stable, component-delimited seeds", () => {
    const rootSeed = parseCalibrationRootSeed(42)

    expect(deriveCalibrationSeed(rootSeed, "ab", "c")).toBe(
      "5f68b780554272cfc021fcb06018dd55",
    )
    expect(deriveCalibrationSeed(rootSeed, "a", "bc")).toBe(
      "39ca6ef5041c422153a557237efa182f",
    )
    expect(CALIBRATION_SEED_DERIVATION_VERSION).toBe(
      "mapachess-sha256-xoshiro128-state/v1",
    )
  })

  it("shuffles reproducibly without mutating the source", () => {
    const source = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]

    expect(
      shuffleDeterministically(
        source,
        parseCalibrationSeed("00000001000000020000000300000004"),
      ),
    ).toEqual([{ id: "b" }, { id: "c" }, { id: "d" }, { id: "a" }])
    expect(source).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }])
  })

  it("rejects undefined entries instead of producing a corrupt shuffle", () => {
    expect(() =>
      shuffleDeterministically(
        [{ id: "valid" }, undefined] as unknown as readonly object[],
        parseCalibrationSeed("00000001000000020000000300000004"),
      ),
    ).toThrow("Cannot shuffle a sparse or undefined collection.")
  })
})

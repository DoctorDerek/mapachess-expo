import { createHash } from "node:crypto"
import {
  createDeterministicRandom,
  DETERMINISTIC_RANDOM_ALGORITHM_VERSION,
  parseDeterministicRandomSeed,
  type DeterministicRandom,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"

export const CALIBRATION_RANDOM_ALGORITHM_VERSION =
  DETERMINISTIC_RANDOM_ALGORITHM_VERSION
export const CALIBRATION_SEED_DERIVATION_VERSION =
  "mapachess-sha256-xoshiro128-state/v1" as const

const UINT32_MAX = 0xffff_ffff

export type CalibrationRootSeed = number & {
  readonly calibrationRootSeed: unique symbol
}

export type CalibrationSeed = DeterministicRandomSeed
export type { DeterministicRandom }

export function parseCalibrationRootSeed(
  value: unknown,
  label = "calibration root seed",
): CalibrationRootSeed {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > UINT32_MAX
  ) {
    throw new TypeError(`${label} must be an unsigned 32-bit integer.`)
  }

  return value as CalibrationRootSeed
}

export function parseCalibrationSeed(
  value: unknown,
  label = "calibration seed",
): CalibrationSeed {
  return parseDeterministicRandomSeed(value, label)
}

export function deriveCalibrationSeed(
  rootSeed: CalibrationRootSeed,
  ...components: readonly string[]
): CalibrationSeed {
  const canonicalInput = JSON.stringify([
    CALIBRATION_SEED_DERIVATION_VERSION,
    rootSeed,
    ...components,
  ])
  const digest = createHash("sha256")
    .update(canonicalInput, "utf8")
    .digest("hex")

  return parseCalibrationSeed(digest.slice(0, 32))
}

export default createDeterministicRandom

export function shuffleDeterministically<T extends object>(
  values: readonly T[],
  seed: CalibrationSeed,
): readonly T[] {
  const shuffled = [...values]
  const random = createDeterministicRandom(seed)

  for (
    let currentIndex = shuffled.length - 1;
    currentIndex > 0;
    currentIndex--
  ) {
    const replacementIndex = random.nextIndex(currentIndex + 1)
    const currentValue = shuffled[currentIndex]
    const replacementValue = shuffled[replacementIndex]

    if (currentValue === undefined || replacementValue === undefined) {
      throw new RangeError("Cannot shuffle a sparse or undefined collection.")
    }

    shuffled[currentIndex] = replacementValue
    shuffled[replacementIndex] = currentValue
  }

  return shuffled
}

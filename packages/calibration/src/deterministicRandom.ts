import { createHash } from "node:crypto"

export const CALIBRATION_RANDOM_ALGORITHM_VERSION =
  "xoshiro128starstar-1.1/v1" as const
export const CALIBRATION_SEED_DERIVATION_VERSION =
  "mapachess-sha256-xoshiro128-state/v1" as const

const UINT32_RANGE = 0x1_0000_0000
const UINT32_MAX = UINT32_RANGE - 1
const CALIBRATION_SEED_PATTERN = /^[0-9a-f]{32}$/
const ZERO_CALIBRATION_SEED = "0".repeat(32)

export type CalibrationRootSeed = number & {
  readonly calibrationRootSeed: unique symbol
}

export type CalibrationSeed = string & {
  readonly calibrationSeed: unique symbol
}

export type DeterministicRandom = Readonly<{
  nextIndex: (upperExclusive: number) => number
  nextUint32: () => number
}>

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
  if (
    typeof value !== "string" ||
    !CALIBRATION_SEED_PATTERN.test(value) ||
    value === ZERO_CALIBRATION_SEED
  ) {
    throw new TypeError(
      `${label} must be a lowercase nonzero 128-bit hexadecimal state.`,
    )
  }

  return value as CalibrationSeed
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

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

export default function createDeterministicRandom(
  initialSeed: CalibrationSeed,
): DeterministicRandom {
  let state0 = Number.parseInt(initialSeed.slice(0, 8), 16)
  let state1 = Number.parseInt(initialSeed.slice(8, 16), 16)
  let state2 = Number.parseInt(initialSeed.slice(16, 24), 16)
  let state3 = Number.parseInt(initialSeed.slice(24, 32), 16)

  const nextUint32 = (): number => {
    const result = Math.imul(rotateLeft(Math.imul(state1, 5), 7), 9) >>> 0
    const shiftedState1 = (state1 << 9) >>> 0

    state2 = (state2 ^ state0) >>> 0
    state3 = (state3 ^ state1) >>> 0
    state1 = (state1 ^ state2) >>> 0
    state0 = (state0 ^ state3) >>> 0
    state2 = (state2 ^ shiftedState1) >>> 0
    state3 = rotateLeft(state3, 11)

    return result
  }

  const nextIndex = (upperExclusive: number): number => {
    if (
      !Number.isSafeInteger(upperExclusive) ||
      upperExclusive <= 0 ||
      upperExclusive > UINT32_RANGE
    ) {
      throw new TypeError(
        `upperExclusive must be an integer from 1 through ${UINT32_RANGE}.`,
      )
    }

    const acceptanceLimit = UINT32_RANGE - (UINT32_RANGE % upperExclusive)
    let sample = nextUint32()

    while (sample >= acceptanceLimit) {
      sample = nextUint32()
    }

    return sample % upperExclusive
  }

  return Object.freeze({ nextIndex, nextUint32 })
}

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

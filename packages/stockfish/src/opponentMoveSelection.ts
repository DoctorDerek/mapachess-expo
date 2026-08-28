export const DETERMINISTIC_RANDOM_ALGORITHM_VERSION =
  "xoshiro128starstar-1.1/v1" as const
export const OPPONENT_MOVE_SELECTION_ALGORITHM_VERSION =
  "best-or-uniform-random-legal/v1" as const
export const OPPONENT_RANDOM_MOVE_PROBABILITY_SCALE = 10_000 as const

const UINT32_RANGE = 0x1_0000_0000
const DETERMINISTIC_RANDOM_SEED_PATTERN = /^[0-9a-f]{32}$/
const ZERO_DETERMINISTIC_RANDOM_SEED = "0".repeat(32)

declare const deterministicRandomSeedBrand: unique symbol

export type DeterministicRandomSeed = string & {
  readonly [deterministicRandomSeedBrand]: true
}

export type DeterministicRandom = Readonly<{
  nextIndex: (upperExclusive: number) => number
  nextUint32: () => number
}>

export type OpponentMoveSelectionSource = "stockfish" | "uniform-random-legal"

export function parseDeterministicRandomSeed(
  value: unknown,
  label = "deterministic random seed",
): DeterministicRandomSeed {
  if (
    typeof value !== "string" ||
    !DETERMINISTIC_RANDOM_SEED_PATTERN.test(value) ||
    value === ZERO_DETERMINISTIC_RANDOM_SEED
  ) {
    throw new TypeError(
      `${label} must be a lowercase nonzero 128-bit hexadecimal state.`,
    )
  }

  return value as DeterministicRandomSeed
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

export function createDeterministicRandom(
  initialSeed: DeterministicRandomSeed,
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

    while (sample >= acceptanceLimit) sample = nextUint32()

    return sample % upperExclusive
  }

  return Object.freeze({ nextIndex, nextUint32 })
}

function assertRandomMoveProbabilityBasisPoints(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > OPPONENT_RANDOM_MOVE_PROBABILITY_SCALE
  ) {
    throw new TypeError(
      `randomMoveProbabilityBasisPoints must be an integer from 0 through ${OPPONENT_RANDOM_MOVE_PROBABILITY_SCALE}.`,
    )
  }
}

export function selectOpponentMoveSource(
  random: DeterministicRandom,
  randomMoveProbabilityBasisPoints: number,
): OpponentMoveSelectionSource {
  assertRandomMoveProbabilityBasisPoints(randomMoveProbabilityBasisPoints)

  return random.nextIndex(OPPONENT_RANDOM_MOVE_PROBABILITY_SCALE) <
    randomMoveProbabilityBasisPoints
    ? "uniform-random-legal"
    : "stockfish"
}

export function selectUniformRandomLegalMove<Move>(
  random: DeterministicRandom,
  legalMoves: readonly Move[],
): Move {
  if (legalMoves.length === 0) {
    throw new RangeError("Cannot select from an empty legal-move collection.")
  }

  const selectedMove = legalMoves[random.nextIndex(legalMoves.length)]
  if (selectedMove === undefined) {
    throw new RangeError("Deterministic legal-move selection failed.")
  }

  return selectedMove
}

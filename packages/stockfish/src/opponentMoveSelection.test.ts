import { webcrypto } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  createDeterministicRandom,
  deriveOpponentPositionSeed,
  DETERMINISTIC_RANDOM_ALGORITHM_VERSION,
  OPPONENT_MOVE_SELECTION_ALGORITHM_VERSION,
  OPPONENT_RANDOM_MOVE_PROBABILITY_SCALE,
  parseDeterministicRandomSeed,
  selectOpponentMoveSource,
  selectUniformRandomLegalMove,
} from "./opponentMoveSelection"

const KNOWN_SEED = "00000001000000020000000300000004"

describe("deterministic opponent move selection", () => {
  it("preserves the shipped position seed and distinguishes subsequent positions", async () => {
    const seed = parseDeterministicRandomSeed(KNOWN_SEED)
    const digest = (bytes: Uint8Array<ArrayBuffer>) =>
      webcrypto.subtle.digest("SHA-256", bytes)
    const requestId = "fixture/opponent/ply/0/fen/start"
    expect(await deriveOpponentPositionSeed(seed, requestId, digest)).toBe(
      "4cefa9645f80d02e027b529a82d3baa3",
    )
    expect(
      await deriveOpponentPositionSeed(seed, `${requestId}/next`, digest),
    ).not.toBe("4cefa9645f80d02e027b529a82d3baa3")
  })

  it("replays the established unsigned xoshiro sequence", () => {
    const random = createDeterministicRandom(
      parseDeterministicRandomSeed(KNOWN_SEED),
    )

    expect([
      random.nextUint32(),
      random.nextUint32(),
      random.nextUint32(),
      random.nextUint32(),
    ]).toEqual([11_520, 0, 5_927_040, 70_819_200])
    expect(DETERMINISTIC_RANDOM_ALGORITHM_VERSION).toBe(
      "xoshiro128starstar-1.1/v1",
    )
  })

  it("rejects modulo-biased samples before choosing a bounded index", () => {
    const random = createDeterministicRandom(
      parseDeterministicRandomSeed("00000001000b60b50000000300000004"),
    )

    expect(random.nextIndex(2_147_483_649)).toBe(5_504)
  })

  it.each([null, 1, "", "0".repeat(32), "A".repeat(32), "g".repeat(32)])(
    "rejects invalid deterministic seed %s",
    (seed) => {
      expect(() => parseDeterministicRandomSeed(seed)).toThrow(TypeError)
    },
  )

  it.each([0, -1, 1.5, 0x1_0000_0001])(
    "rejects invalid upper bound %s",
    (upperExclusive) => {
      const random = createDeterministicRandom(
        parseDeterministicRandomSeed(KNOWN_SEED),
      )

      expect(() => random.nextIndex(upperExclusive)).toThrow(TypeError)
    },
  )

  it("preserves both probability boundaries and policy identity", () => {
    const neverRandom = createDeterministicRandom(
      parseDeterministicRandomSeed(KNOWN_SEED),
    )
    const alwaysRandom = createDeterministicRandom(
      parseDeterministicRandomSeed(KNOWN_SEED),
    )

    expect(selectOpponentMoveSource(neverRandom, 0)).toBe("stockfish")
    expect(
      selectOpponentMoveSource(
        alwaysRandom,
        OPPONENT_RANDOM_MOVE_PROBABILITY_SCALE,
      ),
    ).toBe("uniform-random-legal")
    expect(OPPONENT_MOVE_SELECTION_ALGORITHM_VERSION).toBe(
      "best-or-uniform-random-legal/v1",
    )
  })

  it.each([-1, 0.5, 10_001])(
    "rejects invalid random-move probability %s",
    (probability) => {
      const random = createDeterministicRandom(
        parseDeterministicRandomSeed(KNOWN_SEED),
      )

      expect(() => selectOpponentMoveSource(random, probability)).toThrow(
        TypeError,
      )
    },
  )

  it("selects one legal move through the deterministic stream", () => {
    const random = createDeterministicRandom(
      parseDeterministicRandomSeed(KNOWN_SEED),
    )

    expect(selectUniformRandomLegalMove(random, ["a2a3", "b2b3", "c2c3"])).toBe(
      "a2a3",
    )
    expect(() => selectUniformRandomLegalMove(random, [])).toThrow(RangeError)
  })
})

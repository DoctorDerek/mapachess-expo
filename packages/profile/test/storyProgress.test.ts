import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import applyStoryMatchResult, {
  createInitialStoryProgress,
  formatStoryCompletion,
  selectChallengeUnlockedOpponents,
  selectStoryCompletion,
  selectStoryLadder,
} from "../src/storyProgress.js"
import decodeStoryProgress from "../src/storyProgressCodec.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

describe("earned Story progression", () => {
  it("unlocks only Chicken at first without counting availability as completion", () => {
    const progress = createInitialStoryProgress()
    expect(selectStoryCompletion(progress)).toEqual({
      standard: 0,
      chess960: 0,
      overall: 0,
    })
    for (const variant of ["standard", "chess960"] as const) {
      const ladder = selectStoryLadder(progress, variant)
      expect(ladder).toHaveLength(STOCKFISH_OPPONENTS.length)
      expect(ladder[0]).toMatchObject({
        status: "unlocked",
        highestMedal: null,
      })
      expect(ladder.slice(1).every(({ status }) => status === "locked")).toBe(
        true,
      )
    }
    expect(
      selectChallengeUnlockedOpponents(progress).map(({ id }) => id),
    ).toEqual(["chicken-stockfish"])
  })

  it("advances only the winning ladder and shares defeated animals, not the next unlock", () => {
    const initial = createInitialStoryProgress()
    const win = completedStoryMatch()
    const first = applyStoryMatchResult(initial, win)
    expect(
      selectStoryLadder(first, "standard")
        .slice(0, 3)
        .map(({ status }) => status),
    ).toEqual(["defeated", "unlocked", "locked"])
    expect(first.chess960).toBe(initial.chess960)
    expect(selectStoryCompletion(first)).toEqual({
      standard: 100 / 23,
      chess960: 0,
      overall: 100 / 46,
    })
    expect(selectChallengeUnlockedOpponents(first).map(({ id }) => id)).toEqual(
      ["chicken-stockfish"],
    )
    const second = applyStoryMatchResult(first, {
      ...win,
      opponentId: "bunny-stockfish",
    })
    expect(
      selectChallengeUnlockedOpponents(second).map(({ id }) => id),
    ).toEqual(["chicken-stockfish", "bunny-stockfish"])
    expect(selectStoryLadder(second, "chess960")[1]?.status).toBe("locked")
    expect(initial.standard).toEqual([])
    expect(formatStoryCompletion(selectStoryCompletion(first).standard)).toBe(
      "4.3%",
    )
  })

  it("keeps replayed medals monotonic without adding duplicate victories", () => {
    const win = completedStoryMatch("chess960")
    const bronze = applyStoryMatchResult(createInitialStoryProgress(), {
      ...win,
      pieceHintsUsed: true,
      moveHintsUsed: true,
    })
    expect(bronze.chess960[0]?.highestMedal).toBe("bronze")
    const silver = applyStoryMatchResult(bronze, {
      ...win,
      pieceHintsUsed: true,
    })
    expect(silver.chess960[0]?.highestMedal).toBe("silver")
    const gold = applyStoryMatchResult(silver, win)
    expect(gold.chess960).toEqual([
      { opponentId: "chicken-stockfish", highestMedal: "gold" },
    ])
    expect(applyStoryMatchResult(gold, win)).toBe(gold)
    expect(
      applyStoryMatchResult(gold, {
        ...win,
        pieceHintsUsed: true,
        moveHintsUsed: true,
      }),
    ).toBe(gold)
    expect(gold.standard).toEqual([])
    expect(Object.isFrozen(gold.chess960[0])).toBe(true)
  })

  it("ignores ongoing games, draws, losses and Challenge results", () => {
    const initial = createInitialStoryProgress()
    const win = completedStoryMatch()
    expect(applyStoryMatchResult(initial, null)).toBe(initial)
    expect(applyStoryMatchResult(initial, { ...win, conclusion: null })).toBe(
      initial,
    )
    expect(
      applyStoryMatchResult(initial, {
        ...win,
        conclusion: { type: "draw-agreement" },
      }),
    ).toBe(initial)
    expect(
      applyStoryMatchResult(initial, { ...win, playerColor: "white" }),
    ).toBe(initial)
    expect(applyStoryMatchResult(initial, { ...win, mode: "challenge" })).toBe(
      initial,
    )
  })

  it("rejects skipped opponents and has no extra unlock after the final animal", () => {
    const win = completedStoryMatch()
    expect(() =>
      applyStoryMatchResult(createInitialStoryProgress(), {
        ...win,
        opponentId: "bunny-stockfish",
      }),
    ).toThrow("skip a locked opponent")
    let progress = createInitialStoryProgress()
    for (const variant of ["standard", "chess960"] as const) {
      for (const opponent of STOCKFISH_OPPONENTS) {
        progress = applyStoryMatchResult(progress, {
          ...completedStoryMatch(variant),
          opponentId: opponent.id,
        })
      }
    }
    expect(selectStoryCompletion(progress)).toEqual({
      standard: 100,
      chess960: 100,
      overall: 100,
    })
    expect(
      selectStoryLadder(progress, "standard").every(
        ({ status }) => status === "defeated",
      ),
    ).toBe(true)
    expect(selectChallengeUnlockedOpponents(progress)).toEqual(
      STOCKFISH_OPPONENTS,
    )
  })
})

describe("untrusted Story progress", () => {
  it("copies validated ordered victories without retaining mutable input", () => {
    const source = {
      standard: [{ opponentId: "chicken-stockfish", highestMedal: "bronze" }],
      chess960: [],
    }
    const decoded = decodeStoryProgress(source, "$.storyProgress")
    expect(decoded).toEqual(source)
    expect(decoded.standard).not.toBe(source.standard)
    expect(Object.isFrozen(decoded.standard[0])).toBe(true)
  })

  it.each([
    null,
    { standard: [], chess960: [], extra: true },
    {
      standard: [{ opponentId: "bunny-stockfish", highestMedal: "gold" }],
      chess960: [],
    },
    {
      standard: [{ opponentId: "unknown", highestMedal: "gold" }],
      chess960: [],
    },
    {
      standard: [{ opponentId: "chicken-stockfish", highestMedal: "platinum" }],
      chess960: [],
    },
    {
      standard: Array(24).fill({
        opponentId: "chicken-stockfish",
        highestMedal: "gold",
      }),
      chess960: [],
    },
    {
      standard: Array(2).fill({
        opponentId: "chicken-stockfish",
        highestMedal: "gold",
      }),
      chess960: [],
    },
  ])("rejects malformed or impossible ladder records", (received) => {
    expect(() => decodeStoryProgress(received, "$.storyProgress")).toThrow(
      "PROFILE.DATA_INVALID",
    )
  })
})

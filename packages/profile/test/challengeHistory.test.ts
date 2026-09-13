import { describe, expect, it } from "vitest"
import applyChallengeMatchResult, {
  createInitialChallengeHistory,
  recordChallengeStart,
  type ChallengeHistoryMatch,
} from "../src/challengeHistory.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const challenge = (
  overrides: Partial<ChallengeHistoryMatch> = {},
): ChallengeHistoryMatch => ({
  ...completedStoryMatch(),
  mode: "challenge",
  opponentTargetElo: 1000,
  ...overrides,
})

describe("Challenge history", () => {
  it("keeps empty difficulties empty until a start is recorded", () => {
    const history = createInitialChallengeHistory()
    expect(history.standard.difficulties).toEqual([])
    const started = recordChallengeStart(
      history,
      challenge({ conclusion: null }),
    )
    expect(started.standard.difficulties).toEqual([
      {
        targetElo: 1000,
        lastPlayedAnimal: "chicken-stockfish",
        highestMedal: null,
      },
    ])
    expect(history.standard.difficulties).toEqual([])
    expect(started.chess960).toBe(history.chess960)
  })

  it("keeps the best medal when a different animal is played later", () => {
    const win = challenge()
    const initial = recordChallengeStart(createInitialChallengeHistory(), {
      ...win,
      conclusion: null,
    })
    const won = applyChallengeMatchResult(
      initial,
      { ...win, conclusion: null },
      win,
    )
    const next = challenge({
      matchId: "next",
      opponentId: "raccoon-stockfish",
      conclusion: null,
    })
    const started = recordChallengeStart(won, next)
    expect(started.standard.difficulties).toEqual([
      {
        targetElo: 1000,
        lastPlayedAnimal: "raccoon-stockfish",
        highestMedal: "gold",
      },
    ])
    expect(started.standard.animals[0]).toEqual({
      opponentId: "chicken-stockfish",
      lifetimeWins: 1,
      lifetimeLosses: 0,
      highestMedal: "gold",
    })
    const lowerTierWin = challenge({
      matchId: "second-chicken-win",
      pieceHintsUsed: true,
      moveHintsUsed: true,
    })
    const nextStart = recordChallengeStart(started, {
      ...lowerTierWin,
      conclusion: null,
    })
    const wonAgain = applyChallengeMatchResult(
      nextStart,
      { ...lowerTierWin, conclusion: null },
      lowerTierWin,
    )
    expect(wonAgain.standard.difficulties[0]?.highestMedal).toBe("gold")
    expect(wonAgain.standard.animals[0]).toEqual({
      opponentId: "chicken-stockfish",
      lifetimeWins: 2,
      lifetimeLosses: 0,
      highestMedal: "gold",
    })
  })

  it("does not recount an accepted conclusion on retry or timeline navigation", () => {
    const match = challenge()
    const started = recordChallengeStart(createInitialChallengeHistory(), match)
    const won = applyChallengeMatchResult(
      started,
      { ...match, conclusion: null },
      match,
    )
    expect(applyChallengeMatchResult(won, match, match)).toBe(won)
    expect(applyChallengeMatchResult(won, match, { ...match, cursor: 0 })).toBe(
      won,
    )
  })

  it("counts losses without awarding a medal and ignores draws", () => {
    const loss = challenge({ playerColor: "white" })
    const initial = createInitialChallengeHistory()
    const lost = applyChallengeMatchResult(
      initial,
      { ...loss, conclusion: null },
      loss,
    )
    expect(lost.standard.animals[0]).toEqual({
      opponentId: "chicken-stockfish",
      lifetimeWins: 0,
      lifetimeLosses: 1,
      highestMedal: null,
    })
    expect(
      applyChallengeMatchResult(
        lost,
        null,
        challenge({ conclusion: { type: "draw-agreement" } }),
      ),
    ).toBe(lost)
  })

  it.each([
    [false, false, "gold"],
    [true, false, "silver"],
    [true, true, "bronze"],
  ] as const)(
    "awards medals from accepted hint use (%s, %s)",
    (pieceHintsUsed, moveHintsUsed, medal) => {
      const match = challenge({ pieceHintsUsed, moveHintsUsed })
      const started = recordChallengeStart(
        createInitialChallengeHistory(),
        match,
      )
      expect(
        applyChallengeMatchResult(started, null, match).standard.difficulties[0]
          ?.highestMedal,
      ).toBe(medal)
    },
  )

  it("does not mix variant histories or invent an unknown historical Elo", () => {
    const match = challenge({
      ...completedStoryMatch("chess960"),
      mode: "challenge",
      opponentTargetElo: null,
    })
    const initial = createInitialChallengeHistory()
    expect(recordChallengeStart(initial, match)).toBe(initial)
    const won = applyChallengeMatchResult(initial, null, match)
    expect(won.standard).toBe(initial.standard)
    expect(won.chess960.difficulties).toEqual([])
    expect(won.chess960.animals[0]?.lifetimeWins).toBe(1)
  })
})

import { describe, expect, it } from "vitest"
import applyChallengeMatchResult, {
  createInitialChallengeHistory,
  recordChallengeStart,
} from "../src/challengeHistory.js"
import decodeChallengeHistory, {
  canonicalChallengeHistory,
} from "../src/challengeHistoryCodec.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPlayerData } from "../src/playerDataCodec.js"
import { replaceActiveMatch } from "../src/profileMutations.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const wonHistory = () => {
  const match = {
    ...completedStoryMatch(),
    mode: "challenge" as const,
    opponentTargetElo: 1000,
  }
  return applyChallengeMatchResult(
    recordChallengeStart(createInitialChallengeHistory(), match),
    null,
    match,
  )
}

describe("durable Challenge history", () => {
  it("commits a victory once with its profile and preserves it after exit and reload", () => {
    const match = {
      ...completedStoryMatch(),
      mode: "challenge" as const,
      opponentTargetElo: 1000,
    }
    const started = replaceActiveMatch(
      createInitialMapachessPlayerData(),
      { ...match, conclusion: null },
      {
        variant: "standard",
        chess960PositionId: null,
        playerColor: "black",
        opponentId: "chicken-stockfish",
        difficultyTargetElo: 1000,
      },
    )
    const won = replaceActiveMatch(started, match)
    const replayed = replaceActiveMatch(won, match)
    expect(replayed.challengeHistory).toBe(won.challengeHistory)
    const exited = replaceActiveMatch(replayed, null)
    expect(exited.challengeHistory.standard.animals[0]?.lifetimeWins).toBe(1)
    expect(exited.challengeHistory.standard.difficulties[0]?.highestMedal).toBe(
      "gold",
    )
    expect(
      decodeMapachessPlayerData(JSON.parse(JSON.stringify(exited))),
    ).toEqual({ ok: true, data: exited })
  })
  it("round-trips real records inside the player profile", () => {
    const data = {
      ...createInitialMapachessPlayerData(),
      challengeHistory: wonHistory(),
    }
    expect(decodeMapachessPlayerData(JSON.parse(JSON.stringify(data)))).toEqual(
      { ok: true, data },
    )
  })

  it("migrates a version-five profile without inventing past records", () => {
    const { challengeHistory: omitted, ...old } =
      createInitialMapachessPlayerData()
    expect(omitted).toEqual(createInitialChallengeHistory())
    const result = decodeMapachessPlayerData({ ...old, schemaVersion: 5 })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected migration")
    expect(result.data.challengeHistory).toEqual(
      createInitialChallengeHistory(),
    )
    expect(result.data.settings).toEqual(old.settings)
  })

  it("rejects duplicate difficulty and animal identities", () => {
    const history = wonHistory()
    expect(() =>
      decodeChallengeHistory(
        {
          ...history,
          standard: {
            ...history.standard,
            difficulties: [
              ...history.standard.difficulties,
              ...history.standard.difficulties,
            ],
          },
        },
        "$.challengeHistory",
      ),
    ).toThrow()
    expect(() =>
      decodeChallengeHistory(
        {
          ...history,
          standard: {
            ...history.standard,
            animals: [...history.standard.animals, ...history.standard.animals],
          },
        },
        "$.challengeHistory",
      ),
    ).toThrow()
  })

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid lifetime counts: %s",
    (lifetimeWins) => {
      const history = wonHistory()
      expect(() =>
        decodeChallengeHistory(
          {
            ...history,
            standard: {
              ...history.standard,
              animals: [{ ...history.standard.animals[0], lifetimeWins }],
            },
          },
          "$.challengeHistory",
        ),
      ).toThrow()
    },
  )

  it("keeps canonical identity independent of difficulty ordering", () => {
    const history = recordChallengeStart(wonHistory(), {
      ...completedStoryMatch(),
      mode: "challenge",
      opponentTargetElo: 500,
    })
    expect(
      canonicalChallengeHistory({
        ...history,
        standard: {
          ...history.standard,
          difficulties: [...history.standard.difficulties].reverse(),
        },
      }),
    ).toEqual(canonicalChallengeHistory(history))
  })
})

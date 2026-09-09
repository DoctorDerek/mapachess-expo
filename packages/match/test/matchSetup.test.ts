import { describe, expect, it } from "vitest"
import parseChallengeSetup, {
  DEFAULT_CHALLENGE_SETUP,
} from "../src/challengeSetup.js"
import { parseChess960PositionId } from "../src/chess960Position.js"
import createMatchSetupForMode, {
  MATCH_MODE_CHOICES,
  matchModeLabel,
} from "../src/matchSetup.js"

describe("match setup choices", () => {
  it("parses animal and difficulty independently and rejects malformed boundaries", () => {
    const setup = {
      ...DEFAULT_CHALLENGE_SETUP,
      opponentId: "raccoon-stockfish",
      difficultyTargetElo: 200,
    }
    expect(parseChallengeSetup(setup)).toEqual({ ok: true, setup })
    for (const invalid of [
      { ...setup, opponentId: "unknown" },
      { ...setup, difficultyTargetElo: "200" },
      { ...setup, difficultyTargetElo: 99 },
      { ...setup, difficultyTargetElo: 200.5 },
      { ...setup, difficultyTargetElo: Number.NaN },
      { ...setup, extra: true },
    ])
      expect(parseChallengeSetup(invalid)).toEqual({ ok: false })
  })
  it("names the four independently tracked combinations of mode and variant", () => {
    expect(MATCH_MODE_CHOICES.map(matchModeLabel)).toEqual([
      "Standard Story",
      "Standard Challenge",
      "Chess960 Story",
      "Chess960 Challenge",
    ])
  })

  it.each([0, 959])(
    "remembers Challenge position %i and color without leaking them into Story or Standard",
    (number) => {
      const position = parseChess960PositionId(number)
      if (!position.ok) throw new Error("Invalid test position")
      const remembered = {
        opponentId: "bunny-stockfish",
        difficultyTargetElo: 1000,
        variant: "chess960",
        playerColor: "black",
        chess960PositionId: position.positionId,
      } as const
      expect(
        createMatchSetupForMode(
          { mode: "challenge", variant: "chess960" },
          remembered,
        ),
      ).toEqual({
        mode: "challenge",
        challengeSetup: remembered,
      })
      expect(
        createMatchSetupForMode(
          { mode: "challenge", variant: "standard" },
          remembered,
        ),
      ).toEqual({
        mode: "challenge",
        challengeSetup: {
          ...remembered,
          variant: "standard",
          chess960PositionId: null,
        },
      })
      expect(
        createMatchSetupForMode(
          { mode: "story", variant: "chess960" },
          remembered,
        ),
      ).toEqual({
        mode: "story",
        variant: "chess960",
      })
    },
  )

  it("uses Random for a fresh Chess960 Challenge without inventing a saved position", () => {
    expect(
      createMatchSetupForMode(
        { mode: "challenge", variant: "chess960" },
        DEFAULT_CHALLENGE_SETUP,
      ),
    ).toEqual({
      mode: "challenge",
      challengeSetup: {
        ...DEFAULT_CHALLENGE_SETUP,
        variant: "chess960",
        playerColor: "white",
        chess960PositionId: null,
      },
    })
  })
})

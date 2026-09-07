import { describe, expect, it } from "vitest"
import { DEFAULT_CHALLENGE_SETUP } from "../src/challengeSetup.js"
import { parseChess960PositionId } from "../src/chess960Position.js"
import createMatchSetupForMode, {
  MATCH_MODE_CHOICES,
  matchModeLabel,
} from "../src/matchSetup.js"

describe("match setup choices", () => {
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
        variant: "chess960",
        playerColor: "white",
        chess960PositionId: null,
      },
    })
  })
})

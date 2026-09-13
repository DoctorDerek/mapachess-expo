import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"
import WebMatchSetup from "./WebMatchSetup"

describe("Challenge difficulty history presentation", () => {
  const history = {
    difficulties: [
      {
        targetElo: 900,
        highestMedal: "gold" as const,
        lastPlayedAnimal: "dog-stockfish" as const,
      },
      {
        targetElo: 1000,
        highestMedal: null,
        lastPlayedAnimal: "raccoon-stockfish" as const,
      },
    ],
    animals: [],
  }

  it("labels the exact choice with its independent best medal and last animal", () => {
    const markup = renderToStaticMarkup(
      <ChallengeDifficultyChoices
        disabled={false}
        history={history}
        targets={[900, 1000, 1100]}
        selectedElo={1000}
        onSelected={vi.fn()}
      />,
    )
    const tiles = markup.match(/<label\b[^>]*>[\s\S]*?<\/label>/g) ?? []
    expect(tiles).toHaveLength(3)
    expect(tiles[0]).toContain("Best medal: Gold")
    expect(tiles[0]).toContain("Last played: Dog Stockfish")
    expect(tiles[0]).toMatch(/<span aria-hidden="true"[^>]*>🥇<\/span>/)
    expect(tiles[1]).toContain('checked="" value="1000"')
    expect(tiles[1]).toContain("Last played: Raccoon Stockfish")
    expect(tiles[1]).not.toContain("Best medal")
    expect(tiles[2]).not.toContain("Best medal")
    expect(tiles[2]).not.toContain("Last played")
    expect(markup).toContain("Gold — no hints")
    expect(markup).toContain("<summary")
    expect(markup).not.toContain('type="checkbox"')
  })

  it.each(["standard", "chess960"] as const)(
    "reads only %s history and does not select the historical animal",
    (variant) => {
      const data = createInitialMapachessPlayerData()
      const markup = renderToStaticMarkup(
        <WebMatchSetup
          autoHintMode="no-auto-hints"
          challengeHistory={{
            standard: history,
            chess960: data.challengeHistory.chess960,
          }}
          disabled={false}
          onAutoHintModeChanged={vi.fn()}
          onBack={vi.fn()}
          onStart={vi.fn()}
          setup={{
            mode: "challenge",
            challengeSetup: {
              ...DEFAULT_CHALLENGE_SETUP,
              variant,
              chess960PositionId: null,
              difficultyTargetElo: 900,
            },
          }}
          storyProgress={data.storyProgress}
        />,
      )
      expect(markup).toMatch(
        /name="challenge-opponent"[^>]*checked="" value="chicken-stockfish"/,
      )
      expect(markup.includes("Last played: Dog Stockfish")).toBe(
        variant === "standard",
      )
      expect(markup.includes("Best medal: Gold")).toBe(variant === "standard")
      expect(markup).toMatch(
        /name="challenge-difficulty"[^>]*checked="" value="900"/,
      )
    },
  )

  it("disables the entire radio group while setup is unavailable", () => {
    const markup = renderToStaticMarkup(
      <ChallengeDifficultyChoices
        disabled
        history={history}
        targets={[900]}
        selectedElo={900}
        onSelected={vi.fn()}
      />,
    )
    expect(markup).toMatch(/<fieldset[^>]*disabled=""/)
  })
})

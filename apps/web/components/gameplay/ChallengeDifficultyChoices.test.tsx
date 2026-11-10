import { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import challengeDifficultyGrid, {
  createChallengeDifficultyDraft,
} from "@mapachess/gameplay/challenge-difficulty"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import medalArtworkSource from "../../lib/presentation/medalArtwork"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"

const history = {
  standard: {
    animals: [],
    difficulties: [
      {
        targetElo: 900,
        highestMedal: "gold",
        lastPlayedAnimal: "dog-stockfish",
      },
      {
        targetElo: 1000,
        highestMedal: null,
        lastPlayedAnimal: "raccoon-stockfish",
      },
    ],
  },
  chess960: { animals: [], difficulties: [] },
} as const satisfies MapachessPlayerData["challengeHistory"]

function renderDifficulty(
  variant: MatchVariant,
  elo: number,
  disabled = false,
) {
  const grid = challengeDifficultyGrid(variant)
  return renderToStaticMarkup(
    <ChallengeDifficultyChoices
      disabled={disabled}
      draft={createChallengeDifficultyDraft(grid, elo)}
      exactInput={createRef<HTMLInputElement>()}
      grid={grid}
      history={history}
      onEdit={vi.fn()}
      variant={variant}
    />,
  )
}

describe("inline Challenge difficulty history", () => {
  it("shows the selected record as facts alongside the two labeled controls", () => {
    const markup = renderDifficulty("standard", 900)
    expect(markup).toContain("Opponent Elo")
    expect(markup).toContain('aria-label="Adjust opponent Elo"')
    expect(markup).toContain('aria-valuetext="900 Elo"')
    expect(markup).toContain('max="2350"')
    expect(markup).toContain('min="100"')
    expect(markup).toContain('step="25"')
    expect(markup).toContain("Best medal")
    expect(markup).toContain("Gold")
    expect(markup).toContain("Last played")
    expect(markup).toContain("Dog Stockfish")
    expect(markup).toContain(
      `src="${medalArtworkSource("gold")}" alt="" aria-hidden="true"`,
    )
    expect(markup).not.toMatch(
      /<(details|summary|select|button)\b|type="radio"/,
    )
    expect(markup).not.toContain("Raccoon Stockfish")
  })

  it("shows a played opponent with no invented medal", () => {
    const markup = renderDifficulty("standard", 1000)
    expect(markup).toContain("Raccoon Stockfish")
    expect(markup).not.toContain("Best medal")
    expect(markup).not.toContain("No matches at this Elo.")
  })

  it("does not borrow a record from another variant or invent a history", () => {
    const markup = renderDifficulty("chess960", 900)
    expect(markup).toContain("No matches at this Elo.")
    expect(markup).not.toContain("Best medal")
    expect(markup).not.toContain("Dog Stockfish")
  })

  it("disables both Elo inputs while setup is unavailable", () => {
    expect(renderDifficulty("standard", 900, true)).toMatch(
      /<fieldset[^>]*disabled=""/,
    )
  })
})

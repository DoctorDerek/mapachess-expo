import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import { createInitialStoryProgress } from "@mapachess/profile/story-progress"
import PlayerAnimalChoices from "./PlayerAnimalChoices"

describe("player animal choices", () => {
  it("exposes every real animal, a selected raccoon and explicit locks", () => {
    const markup = renderToStaticMarkup(
      <PlayerAnimalChoices
        disabled={false}
        onSelected={vi.fn()}
        selectedId="raccoon-stockfish"
        storyProgress={createInitialStoryProgress()}
      />,
    )
    expect(markup.match(/type="radio"/g)).toHaveLength(23)
    expect(markup.match(/disabled=""/g)).toHaveLength(22)
    expect(markup.match(/Locked/g)).toHaveLength(22)
    expect(markup.match(/checked=""/g)).toHaveLength(1)
    expect(markup).toContain("Play as")
    expect(markup).toContain("Beat animals in Story")
    for (const opponent of STOCKFISH_OPPONENTS)
      expect(markup).toContain(`value="${opponent.id}"`)
  })

  it("retains a previously selected Chicken, but does not newly offer it", () => {
    const markup = renderToStaticMarkup(
      <PlayerAnimalChoices
        disabled={false}
        onSelected={vi.fn()}
        selectedId="chicken-stockfish"
        storyProgress={createInitialStoryProgress()}
      />,
    )
    expect(markup.match(/disabled=""/g)).toHaveLength(21)
    expect(markup.match(/checked=""/g)).toHaveLength(1)
  })

  it("does not prepare animation images while hidden", () => {
    const markup = renderToStaticMarkup(
      <PlayerAnimalChoices
        active={false}
        disabled={false}
        onSelected={vi.fn()}
        selectedId="raccoon-stockfish"
        storyProgress={createInitialStoryProgress()}
      />,
    )
    expect(markup).not.toContain('rel="preload"')
  })
})

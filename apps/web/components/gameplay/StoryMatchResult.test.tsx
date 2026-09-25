import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import {
  createInitialStoryProgress,
  type StoryMatchResult as SavedResult,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import StoryMatchResult from "./StoryMatchResult"

const win: SavedResult = {
  mode: "story",
  opponentId: "chicken-stockfish",
  playerColor: "white",
  startingPosition: { variant: "standard", chess960PositionId: null },
  conclusion: { type: "resignation", winner: "white" },
  pieceHintsUsed: false,
  moveHintsUsed: false,
}
const progress: StoryProgress = {
  standard: [{ opponentId: "chicken-stockfish", highestMedal: "gold" }],
  chess960: [],
}
const render = (match = win, records = progress) =>
  renderToStaticMarkup(
    <StoryMatchResult
      match={match}
      progress={records}
      disabled={false}
      opening={false}
      onSetupRequested={vi.fn()}
    />,
  )

describe("saved Story result presentation", () => {
  it("shows the earned medal and next opponent without repeating an equal best", () => {
    const result = render()
    expect(result).toContain("Gold this match")
    expect(result).not.toContain("Your best:")
    expect(result).toContain("Up next:")
    expect(result).toContain("Next opponent")
    expect(result).toContain(
      "Chicken Stockfish is available in both Challenge modes",
    )
    expect(result).not.toContain("XP")
    expect(result).not.toContain("You won!")
    expect(result).toContain("Saved")
  })
  it("distinguishes a lower replay medal from the retained best", () => {
    const result = render({ ...win, pieceHintsUsed: true, moveHintsUsed: true })
    expect(result).toContain("Bronze this match")
    expect(result).toContain("Your best: Gold")
  })
  it("explains Silver without implying Piece Hints prevent a medal", () => {
    const result = render({ ...win, pieceHintsUsed: true })
    expect(result).toContain("Silver this match")
    expect(result).toContain("Piece Hints used · no Move Hints.")
    expect(result).toContain("Your best: Gold")
  })
  it("uses the matching variant's ladder", () => {
    const position = parseChess960PositionId(518)
    if (!position.ok) throw new Error("Invalid test position")
    const result = render(
      {
        ...win,
        startingPosition: {
          variant: "chess960",
          chess960PositionId: position.positionId,
        },
      },
      { standard: [], chess960: progress.standard },
    )
    expect(result).toContain("Gold this match")
    expect(result).toContain("Next opponent")
  })
  it.each([
    { type: "draw-agreement" },
    { type: "resignation", winner: "black" },
  ] as const)("awards no medal or next opponent for $type", (conclusion) => {
    const result = render({ ...win, conclusion })
    expect(result).toContain("No new medal")
    expect(result).toContain("Your Story progress is unchanged.")
    expect(result).not.toContain("Next opponent")
    expect(result).toContain("Replay opponent")
  })
  it("offers replay rather than a nonexistent next opponent after completion", () => {
    const result = render(win, {
      standard: STOCKFISH_OPPONENTS.map(({ id }) => ({
        opponentId: id,
        highestMedal: "gold",
      })),
      chess960: [],
    })
    expect(result).toContain("Story complete!")
    expect(result).toContain("Story ladder")
    expect(result).not.toContain("Next opponent")
  })
  it("does not present results for unfinished or Challenge matches", () => {
    expect(
      render({ ...win, conclusion: null }, createInitialStoryProgress()),
    ).toBe("")
    expect(render({ ...win, mode: "challenge" })).toBe("")
  })
})

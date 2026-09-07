import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import {
  createInitialStoryProgress,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import StoryLadderProgress from "./StoryLadderProgress"
import WebMatchSetup from "./WebMatchSetup"

const progress: StoryProgress = {
  standard: [{ opponentId: "chicken-stockfish", highestMedal: "gold" }],
  chess960: [],
}

describe("Story ladder presentation structure", () => {
  it("exposes ordered earned and locked status without future-opponent action buttons", () => {
    const markup = renderToStaticMarkup(
      <StoryLadderProgress progress={progress} variant="standard" />,
    )
    expect(markup).toContain('<ol aria-label="Story opponents in ladder order"')
    expect(markup).toContain("Defeated · Gold")
    expect(markup).toContain("Bunny Stockfish")
    expect(markup).not.toContain("Dog Stockfish")
    expect(markup).toContain("4.3%")
    expect(markup).toContain("2.2%")
    expect(markup).toContain("0%")
    expect(markup).toContain(
      "Additional opponents and their artwork are still in development",
    )
    expect(markup).not.toContain("<button")
  })

  it("does not carry a Standard victory into the Chess960 ladder", () => {
    const markup = renderToStaticMarkup(
      <StoryLadderProgress progress={progress} variant="chess960" />,
    )
    expect(markup).toContain("Next unlocked opponent: Chicken Stockfish")
    expect(markup).not.toContain("Bunny Stockfish")
    expect(markup).not.toContain("Defeated · Gold")
  })

  it("composes Story progress only into Story setup", () => {
    const props = {
      activityMessage: null,
      autoHintMode: "auto-move-hints" as const,
      disabled: false,
      onAutoHintModeChanged: vi.fn(),
      onBack: vi.fn(),
      onStart: vi.fn(),
      opponent: stockfishOpponent("chicken-stockfish"),
      storyProgress: createInitialStoryProgress(),
    }
    const story = renderToStaticMarkup(
      <WebMatchSetup
        {...props}
        setup={{ mode: "story", variant: "standard" }}
      />,
    )
    const challenge = renderToStaticMarkup(
      <WebMatchSetup
        {...props}
        setup={{
          mode: "challenge",
          challengeSetup: {
            variant: "standard",
            playerColor: "white",
            chess960PositionId: null,
          },
        }}
      />,
    )
    expect(story).toContain("Your Story ladder")
    expect(story).toContain("Start match")
    expect(challenge).not.toContain("Your Story ladder")
    expect(challenge).toContain("Play as")
  })
})

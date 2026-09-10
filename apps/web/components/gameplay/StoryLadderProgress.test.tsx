import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
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
  it.each([
    { highestMedal: "bronze", symbol: "🥉", label: "Bronze" },
    { highestMedal: "silver", symbol: "🥈", label: "Silver" },
    { highestMedal: "gold", symbol: "🥇", label: "Gold" },
  ] as const)(
    "shows $label records with a decorative medal and readable text",
    ({ highestMedal, symbol, label }) => {
      for (const variant of ["standard", "chess960"] as const) {
        const markup = renderToStaticMarkup(
          <StoryLadderProgress
            progress={{
              ...createInitialStoryProgress(),
              [variant]: [{ opponentId: "chicken-stockfish", highestMedal }],
            }}
            variant={variant}
          />,
        )
        expect(markup).toContain(`Defeated · ${label}`)
        expect(markup).toMatch(
          new RegExp(`<span[^>]*aria-hidden="true"[^>]*>${symbol}</span>`),
        )
        expect(markup.match(new RegExp(symbol, "gu"))).toHaveLength(1)
      }
    },
  )

  it.each([
    { ...DEFAULT_CHALLENGE_SETUP, opponentId: "bunny-stockfish" as const },
    { ...DEFAULT_CHALLENGE_SETUP, difficultyTargetElo: 1100 },
  ])(
    "keeps unavailable remembered choices in a recoverable setup state",
    (challengeSetup) => {
      const markup = renderToStaticMarkup(
        <WebMatchSetup
          autoHintMode="no-auto-hints"
          disabled={false}
          onAutoHintModeChanged={vi.fn()}
          onBack={vi.fn()}
          onStart={vi.fn()}
          setup={{ mode: "challenge", challengeSetup }}
          storyProgress={createInitialStoryProgress()}
        />,
      )
      expect(markup).toContain(
        "Choose an earned animal and supported difficulty.",
      )
      expect(markup).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/)
      expect(markup).toContain('value="chicken-stockfish"')
      expect(markup).toContain('value="100"')
    },
  )
  it.each(["standard", "chess960"] as const)(
    "offers globally earned animals and independently selected %s difficulty without a dropdown",
    (variant) => {
      const markup = renderToStaticMarkup(
        <WebMatchSetup
          autoHintMode="no-auto-hints"
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
              opponentId: "bunny-stockfish",
              difficultyTargetElo: 1000,
            },
          }}
          storyProgress={{
            standard: [],
            chess960: [
              { opponentId: "chicken-stockfish", highestMedal: "gold" },
              { opponentId: "bunny-stockfish", highestMedal: "silver" },
            ],
          }}
        />,
      )
      expect(markup).toContain("Bunny Stockfish")
      expect(markup).not.toContain('value="dog-stockfish"')
      expect(markup).toMatch(
        /name="challenge-opponent"[^>]*checked=""[^>]*value="bunny-stockfish"/,
      )
      expect(markup).toMatch(
        /name="challenge-difficulty"[^>]*checked=""[^>]*value="1000"/,
      )
      expect(markup).toContain("Difficulty · provisional Elo target")
      expect(markup).not.toContain("<select")
      expect(markup).not.toContain("Your Story ladder")
    },
  )
  it("offers earned opponents as named choices and defaults setup to the next unlocked animal", () => {
    const markup = renderToStaticMarkup(
      <WebMatchSetup
        autoHintMode="no-auto-hints"
        disabled={false}
        onAutoHintModeChanged={vi.fn()}
        onBack={vi.fn()}
        onStart={vi.fn()}
        setup={{ mode: "story", variant: "standard" }}
        storyProgress={progress}
      />,
    )
    expect(markup).toContain('value="chicken-stockfish"')
    expect(markup).toMatch(/checked="" value="bunny-stockfish"/)
    expect(markup).not.toContain('value="dog-stockfish"')
    expect(markup).not.toContain("Dog Stockfish")
    expect(markup).toContain("Defeated · Gold")
    expect(markup).not.toContain("<select")
  })

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
    expect(markup).toContain("Play through Raccoon now.")
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
      autoHintMode: "auto-move-hints" as const,
      disabled: false,
      onAutoHintModeChanged: vi.fn(),
      onBack: vi.fn(),
      onStart: vi.fn(),
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
            ...DEFAULT_CHALLENGE_SETUP,
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

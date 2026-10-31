import type { ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import applyStoryMatchResult, {
  createInitialStoryProgress,
} from "@mapachess/profile/story-progress"
import MatchCelebration from "./MatchCelebration"

const startingPosition = {
  variant: "standard",
  chess960PositionId: null,
} as const
const completed = {
  autoHintMode: "no-auto-hints",
  conclusion: { type: "checkmate", winner: "black" },
  currentFen: createInitialMatchPosition(startingPosition).fen,
  cursor: 0,
  matchId: "celebration-composition",
  matchSeed: "00000001000000020000000300000004",
  mode: "story",
  moveHintsUsed: false,
  moveIds: [],
  opponentId: "chicken-stockfish",
  opponentPolicyFingerprint: "composition-fixture",
  pieceHintsUsed: false,
  playerColor: "black",
  playerEloAtStart: 100,
  recordVersion: DURABLE_MATCH_RECORD_VERSION,
  startingPosition,
  timeControl: { type: "untimed" },
} as const satisfies DurableMatchRecord
const reward = {
  matchId: completed.matchId,
  awardedXp: 4,
  totalXpBefore: 0,
  unlockedAchievementIds: [],
  ratedElo: null,
} as const

const renderCelebration = (
  overrides: Partial<ComponentProps<typeof MatchCelebration>> = {},
) =>
  renderToStaticMarkup(
    <MatchCelebration
      battleStageRef={vi.fn()}
      disabled={false}
      match={completed}
      onDismiss={vi.fn()}
      onReplayRequested={vi.fn()}
      onSetupRequested={vi.fn()}
      restoreFocusRef={{ current: null }}
      reward={reward}
      showSaveConfirmation={true}
      storyProgress={applyStoryMatchResult(
        createInitialStoryProgress(),
        completed,
      )}
      {...overrides}
    />,
  )

describe("accepted match celebration composition", () => {
  it("shows earned Story facts and safe actions without an invented Elo row", () => {
    const markup = renderCelebration()

    expect(markup).toContain("You defeated Chicken Stockfish!")
    expect(markup).toContain("Gold")
    expect(markup).toContain("+4 XP")
    expect(markup).toContain("Level 3")
    expect(markup).toContain("Review board")
    expect(markup).toContain("Next opponent")
    expect(markup).toContain("Bunny Stockfish · 200 Elo")
    expect(markup).not.toContain("Standard Chess Elo")
    expect(markup).not.toContain("Next:")
    expect(markup).not.toContain("Estimated")
    expect(markup).toContain("No hints used")
    expect(markup).toContain("Saved locally")
    expect(markup.indexOf("Saved locally")).toBeLessThan(
      markup.indexOf("Next opponent"),
    )
  })

  it("shows a Challenge replay and only the variant Elo actually awarded", () => {
    const markup = renderCelebration({
      match: { ...completed, mode: "challenge", opponentTargetElo: 900 },
      reward: {
        ...reward,
        ratedElo: { variant: "standard", before: 100, after: 228 },
      },
      showSaveConfirmation: false,
      storyProgress: createInitialStoryProgress(),
    })
    expect(markup).toContain("Replay opponent")
    expect(markup).toContain("Standard")
    expect(markup).toContain("100 → 228")
    expect(markup).not.toContain("Next opponent")
    expect(markup).not.toContain("Saved locally")
    expect(markup).toContain("Chicken Stockfish")
    expect(markup).toContain("900 Elo")
    expect(markup).not.toContain("Chicken Stockfish · 100 Elo")
  })

  it("keeps both actions without inventing Level or XP for an ending without reward data", () => {
    const markup = renderCelebration({
      reward: null,
      showSaveConfirmation: false,
    })
    expect(markup).toContain("Review board")
    expect(markup).toContain("Next opponent")
    expect(markup).not.toContain("Level")
    expect(markup).not.toContain("XP")
  })
})

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

describe("accepted match celebration composition", () => {
  it("shows earned Story facts and safe actions without an invented Elo row", () => {
    const markup = renderToStaticMarkup(
      <MatchCelebration
        disabled={false}
        match={completed}
        onDismiss={vi.fn()}
        onReplayRequested={vi.fn()}
        onSetupRequested={vi.fn()}
        restoreFocusRef={{ current: null }}
        reward={reward}
        storyProgress={applyStoryMatchResult(
          createInitialStoryProgress(),
          completed,
        )}
      />,
    )

    expect(markup).toContain("You won!")
    expect(markup).toContain("Gold")
    expect(markup).toContain("+4 XP")
    expect(markup).toContain("Level 3")
    expect(markup).toContain("Review board")
    expect(markup).toContain("Next opponent")
    expect(markup).not.toContain("Elo")
    expect(markup).not.toContain("Estimated")
  })

  it("shows a Challenge replay and only the variant Elo actually awarded", () => {
    const markup = renderToStaticMarkup(
      <MatchCelebration
        disabled={false}
        match={{ ...completed, mode: "challenge" }}
        onDismiss={vi.fn()}
        onReplayRequested={vi.fn()}
        onSetupRequested={vi.fn()}
        restoreFocusRef={{ current: null }}
        reward={{
          ...reward,
          ratedElo: { variant: "standard", before: 100, after: 228 },
        }}
        storyProgress={createInitialStoryProgress()}
      />,
    )
    expect(markup).toContain("Replay match")
    expect(markup).toContain("Standard")
    expect(markup).toContain("100 → 228")
    expect(markup).not.toContain("Next opponent")
  })
})
